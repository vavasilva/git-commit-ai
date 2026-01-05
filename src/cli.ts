import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline";

import { loadConfig, saveConfig, showConfig, getConfigPath, updateConfig, VALID_CONFIG_KEYS, CONFIG_ALIASES } from "./config.js";
import {
  createBackend,
  detectBackend,
  getAvailableBackends,
  DEFAULT_MODELS,
  type Backend,
} from "./backends/index.js";
import {
  getStagedDiff,
  getFileDiff,
  addFiles,
  commit,
  commitAmend,
  push,
  getStagedFiles,
  resetStaged,
  getLastCommitDiff,
  filterDiffByPatterns,
  GitError,
} from "./git.js";
import {
  buildPrompt,
  buildSummarizePrompt,
  cleanMessage,
  validateMessage,
  fixMessage,
  isValidType,
  getValidTypes,
  addIssueReference,
  addCoAuthors,
  ensureBreakingMarker,
  type PromptConstraints,
} from "./prompts.js";
import { installHook, removeHook, isHookInstalled } from "./hook.js";
import {
  enableDebug,
  debug,
  debugConfig,
  debugDiff,
  debugPrompt,
  debugResponse,
  debugValidation,
} from "./debug.js";
import type { Config, BackendType, DiffResult } from "./types.js";

function buildDiffContext(diffResult: DiffResult): string {
  const parts: string[] = [];

  if (diffResult.filesAdded.length > 0) {
    parts.push(`Files added:\n${diffResult.filesAdded.slice(0, 5).join("\n")}`);
    if (diffResult.filesAdded.length > 5) {
      parts.push(`  ... and ${diffResult.filesAdded.length - 5} more added`);
    }
  }

  if (diffResult.filesDeleted.length > 0) {
    parts.push(`Files deleted:\n${diffResult.filesDeleted.slice(0, 5).join("\n")}`);
    if (diffResult.filesDeleted.length > 5) {
      parts.push(`  ... and ${diffResult.filesDeleted.length - 5} more deleted`);
    }
  }

  if (diffResult.filesModified.length > 0) {
    parts.push(`Files modified:\n${diffResult.filesModified.slice(0, 5).join("\n")}`);
    if (diffResult.filesModified.length > 5) {
      parts.push(`  ... and ${diffResult.filesModified.length - 5} more modified`);
    }
  }

  parts.push(`Stats: ${diffResult.stats}`);

  return parts.join("\n");
}

async function promptUser(question: string, choices: string[]): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (choices.includes(normalized)) {
        resolve(normalized);
      } else {
        resolve(choices[0]); // default to first choice
      }
    });
  });
}

async function promptEdit(currentMessage: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(chalk.dim("\nEnter new commit message (or press Enter to keep current):"));
    rl.question(`Message [${currentMessage}]: `, (answer) => {
      rl.close();
      resolve(answer.trim() || currentMessage);
    });
  });
}

async function generateMessage(
  backend: Backend,
  diffContent: string,
  context: string,
  temperatures: number[],
  constraints?: PromptConstraints
): Promise<string | null> {
  const prompt = buildPrompt(diffContent, context, constraints);
  debugPrompt(prompt);

  for (const temp of temperatures) {
    debug(`Trying temperature: ${temp}`);
    try {
      const rawMessage = await backend.generate(prompt, temp);
      debugResponse(rawMessage);

      let message = cleanMessage(rawMessage);

      // Ensure breaking marker if requested
      if (constraints?.breaking) {
        message = ensureBreakingMarker(message);
      }

      const isValid = validateMessage(message);
      debugValidation(message, isValid);

      if (isValid) {
        return message;
      }

      // Try to fix the message
      const fixed = fixMessage(message);
      if (validateMessage(fixed)) {
        debugValidation(fixed, true, fixed);
        return constraints?.breaking ? ensureBreakingMarker(fixed) : fixed;
      }
    } catch (e) {
      const error = e as Error;
      debug(`Generation error: ${error.message}`);
      console.log(chalk.yellow(`Warning: Generation failed at temp ${temp}: ${error.message}`));
    }
  }

  return null;
}

function showMessage(message: string): void {
  console.log();
  console.log(chalk.green("┌─") + chalk.green("─".repeat(68)) + chalk.green("─┐"));
  console.log(chalk.green("│") + chalk.bold(" 📝 Generated commit message") + " ".repeat(40) + chalk.green("│"));
  console.log(chalk.green("├─") + chalk.green("─".repeat(68)) + chalk.green("─┤"));
  console.log(chalk.green("│") + "  " + message.padEnd(67) + chalk.green("│"));
  console.log(chalk.green("└─") + chalk.green("─".repeat(68)) + chalk.green("─┘"));
  console.log();
}

async function promptAction(message: string): Promise<string> {
  showMessage(message);
  return promptUser(
    "[C]onfirm  [E]dit  [R]egenerate  [A]bort? ",
    ["c", "e", "r", "a"]
  );
}

async function runCommitFlow(
  backend: Backend,
  cfg: Config,
  diffContent: string,
  context: string,
  skipConfirm: boolean,
  constraints?: PromptConstraints
): Promise<string | null> {
  const temperatures = [cfg.temperature, ...cfg.retry_temperatures];
  const spinner = ora("Generating commit message...").start();

  while (true) {
    let message: string | null;
    try {
      message = await generateMessage(backend, diffContent, context, temperatures, constraints);
    } finally {
      spinner.stop();
    }

    if (message === null) {
      console.log(chalk.red("Error: Failed to generate a valid commit message."));
      message = "chore: update files";
      console.log(chalk.yellow(`Using fallback: ${message}`));
    }

    if (skipConfirm) {
      return message;
    }

    const action = await promptAction(message);

    if (action === "c") {
      return message;
    } else if (action === "e") {
      return promptEdit(message);
    } else if (action === "r") {
      console.log(chalk.dim("Regenerating..."));
      spinner.start("Generating commit message...");
      continue;
    } else if (action === "a") {
      return null;
    }
  }
}

interface CommitOptions {
  skipConfirm: boolean;
  dryRun: boolean;
  amend: boolean;
  constraints?: PromptConstraints;
  issue?: string;
  coAuthors?: string[];
}

async function handleSingleCommit(
  backend: Backend,
  cfg: Config,
  options: CommitOptions
): Promise<void> {
  let diffResult;

  if (options.amend) {
    // For amend, use the last commit's diff
    diffResult = getLastCommitDiff();
    if (diffResult.isEmpty) {
      console.log(chalk.yellow("No previous commit to amend."));
      process.exit(1);
    }
    console.log(chalk.dim("Amending last commit..."));
  } else {
    diffResult = getStagedDiff();
    if (diffResult.isEmpty) {
      console.log(chalk.yellow("No changes to commit."));
      process.exit(0);
    }
  }

  // Apply ignore patterns
  let diff = diffResult.diff;
  if (cfg.ignore_patterns && cfg.ignore_patterns.length > 0) {
    diff = filterDiffByPatterns(diff, cfg.ignore_patterns);
    if (!diff.trim()) {
      console.log(chalk.yellow("All changes are ignored by ignore_patterns."));
      process.exit(0);
    }
  }

  debugDiff(diff, diffResult.files);
  const context = buildDiffContext(diffResult);

  let message = await runCommitFlow(backend, cfg, diff, context, options.skipConfirm, options.constraints);

  if (message === null) {
    console.log(chalk.yellow("Aborted."));
    process.exit(0);
  }

  // Add issue reference if provided
  if (options.issue) {
    message = addIssueReference(message, options.issue);
  }

  // Add co-authors if provided
  if (options.coAuthors && options.coAuthors.length > 0) {
    message = addCoAuthors(message, options.coAuthors);
  }

  if (options.dryRun) {
    console.log(chalk.cyan("Dry run - message not committed:"));
    console.log(message);
    return;
  }

  try {
    if (options.amend) {
      commitAmend(message);
      debug(`Amend successful: ${message}`);
      console.log(chalk.green("✓ Amended:"), message.split("\n")[0]);
    } else {
      commit(message);
      debug(`Commit successful: ${message}`);
      console.log(chalk.green("✓ Committed:"), message.split("\n")[0]);
    }
  } catch (e) {
    const error = e as GitError;
    debug(`Commit failed: ${error.message}`);
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

async function handleIndividualCommits(
  backend: Backend,
  cfg: Config,
  options: CommitOptions
): Promise<void> {
  // Get files that are already staged
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(chalk.yellow("No staged files to commit."));
    console.log(chalk.dim("Stage files with: git add <files>"));
    process.exit(0);
  }

  console.log(chalk.dim(`Found ${stagedFiles.length} files to commit individually.`));

  // Unstage all files first
  resetStaged();

  for (const filePath of stagedFiles) {
    // Skip files matching ignore patterns
    if (cfg.ignore_patterns && cfg.ignore_patterns.length > 0) {
      const { shouldIgnoreFile } = await import("./git.js");
      if (shouldIgnoreFile(filePath, cfg.ignore_patterns)) {
        console.log(chalk.dim(`Skipping ignored file: ${filePath}`));
        continue;
      }
    }

    // Stage only this file
    const added = addFiles(filePath);
    if (!added) {
      // File is ignored or doesn't exist, skip it
      continue;
    }

    const diffResult = getFileDiff(filePath);

    if (diffResult.isEmpty) {
      continue;
    }

    console.log(chalk.bold(`\nProcessing: ${filePath}`));

    const context = buildDiffContext(diffResult);
    let message = await runCommitFlow(backend, cfg, diffResult.diff, context, options.skipConfirm, options.constraints);

    if (message === null) {
      console.log(chalk.yellow(`Skipped: ${filePath}`));
      continue;
    }

    // Add issue reference if provided
    if (options.issue) {
      message = addIssueReference(message, options.issue);
    }

    // Add co-authors if provided
    if (options.coAuthors && options.coAuthors.length > 0) {
      message = addCoAuthors(message, options.coAuthors);
    }

    if (options.dryRun) {
      console.log(chalk.cyan(`Dry run - ${filePath}:`));
      console.log(message);
      continue;
    }

    try {
      commit(message);
      console.log(chalk.green("✓ Committed:"), message.split("\n")[0]);
    } catch (e) {
      const error = e as GitError;
      console.log(chalk.red(`Error committing ${filePath}: ${error.message}`));
    }
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("git-commit-ai")
    .description("Generate commit messages using LLMs (Ollama, OpenAI, Anthropic, Groq, llama.cpp)")
    .version("0.3.0")
    .option("-p, --push", "Push after commit")
    .option("-y, --yes", "Skip confirmation")
    .option("-i, --individual", "Commit files individually")
    .option("-d, --debug", "Enable debug output")
    .option("--dry-run", "Show generated message without committing")
    .option("-b, --backend <backend>", "Backend to use (ollama, openai, anthropic, groq, llamacpp)")
    .option("-m, --model <model>", "Override model from config")
    .option("-t, --temperature <temp>", "Override temperature (0.0-1.0)", parseFloat)
    .option("--hook-mode", "Called by git hook (outputs message only)")
    .option("--amend", "Regenerate and amend the last commit message")
    .option("-s, --scope <scope>", "Force a specific scope (e.g., auth, api)")
    .option("--type <type>", `Force commit type (${getValidTypes().join(", ")})`)
    .option("-c, --context <text>", "Provide additional context for message generation")
    .option("-l, --lang <code>", "Language for commit message (en, pt, es, fr, de, etc.)")
    .option("--issue <ref>", "Reference an issue (e.g., 123 or #123)")
    .option("--breaking", "Mark as breaking change (adds ! to type)")
    .option("--co-author <author>", "Add co-author (can be used multiple times)", (val: string, prev: string[]) => prev.concat([val]), [] as string[])
    .action(async (options) => {
      if (options.debug) {
        enableDebug();
        debug("Debug mode enabled");
      }

      const cfg = loadConfig();

      // Validate --type flag
      if (options.type && !isValidType(options.type)) {
        console.log(chalk.red(`Error: Invalid commit type "${options.type}"`));
        console.log(chalk.dim(`Valid types: ${getValidTypes().join(", ")}`));
        process.exit(1);
      }

      // Override config with CLI options
      if (options.backend) {
        const validBackends: BackendType[] = ["ollama", "openai", "anthropic", "groq", "llamacpp"];
        if (validBackends.includes(options.backend)) {
          cfg.backend = options.backend;
          // Set default model for the selected backend if model wasn't explicitly set
          if (!options.model && cfg.model === "llama3.1:8b") {
            cfg.model = DEFAULT_MODELS[cfg.backend];
          }
          debug(`Backend overridden to: ${cfg.backend}`);
        } else {
          console.log(chalk.red(`Error: Invalid backend "${options.backend}"`));
          console.log(chalk.dim(`Valid backends: ${validBackends.join(", ")}`));
          process.exit(1);
        }
      }
      if (options.model) {
        cfg.model = options.model;
        debug(`Model overridden to: ${cfg.model}`);
      }
      if (options.temperature !== undefined && !isNaN(options.temperature)) {
        cfg.temperature = options.temperature;
        debug(`Temperature overridden to: ${cfg.temperature}`);
      }

      debugConfig(cfg);

      // Auto-detect backend if not explicitly set and no config
      if (!options.backend && cfg.backend === "ollama") {
        const detected = await detectBackend();
        if (detected !== "ollama") {
          cfg.backend = detected;
          cfg.model = DEFAULT_MODELS[detected];
          debug(`Auto-detected backend: ${detected}`);
        }
      }

      const backend = createBackend(cfg);
      debug(`Using backend: ${cfg.backend} with model: ${cfg.model}`);

      // Check if backend is available
      const available = await backend.isAvailable();
      if (!available) {
        if (options.hookMode) {
          process.exit(1);
        }
        if (cfg.backend === "ollama") {
          console.log(chalk.red("Error: Ollama is not running."));
          console.log(chalk.dim("Start it with: brew services start ollama"));
        } else if (cfg.backend === "llamacpp") {
          console.log(chalk.red("Error: llama.cpp server is not running."));
          console.log(chalk.dim("Start it with: llama-server -m model.gguf --port 8080"));
        } else {
          console.log(chalk.red(`Error: ${cfg.backend} backend is not available.`));
          const envVar = {
            openai: "OPENAI_API_KEY",
            anthropic: "ANTHROPIC_API_KEY",
            groq: "GROQ_API_KEY",
          }[cfg.backend as string];
          if (envVar) {
            console.log(chalk.dim(`Set ${envVar} environment variable.`));
          }
        }
        const availableBackends = getAvailableBackends();
        if (availableBackends.length > 1) {
          console.log(chalk.dim(`Available backends: ${availableBackends.join(", ")}`));
        }
        process.exit(1);
      }

      // Build prompt constraints
      const constraints: PromptConstraints = {
        type: options.type || cfg.default_type,
        scope: options.scope || cfg.default_scope,
        language: options.lang || cfg.default_language,
        breaking: options.breaking,
        context: options.context,
      };

      // Hook mode: just output the message
      if (options.hookMode) {
        const diffResult = getStagedDiff();
        if (diffResult.isEmpty) {
          process.exit(1);
        }

        // Apply ignore patterns
        let diff = diffResult.diff;
        if (cfg.ignore_patterns && cfg.ignore_patterns.length > 0) {
          diff = filterDiffByPatterns(diff, cfg.ignore_patterns);
        }

        const context = buildDiffContext(diffResult);
        const temperatures = [cfg.temperature, ...cfg.retry_temperatures];
        const message = await generateMessage(backend, diff, context, temperatures, constraints);

        if (message) {
          console.log(message);
          process.exit(0);
        }
        process.exit(1);
      }

      // Build commit options
      const commitOptions: CommitOptions = {
        skipConfirm: options.yes,
        dryRun: options.dryRun,
        amend: options.amend,
        constraints,
        issue: options.issue,
        coAuthors: options.coAuthor,
      };

      // Don't stage files if amending
      if (!options.amend) {
        addFiles(".");
      }

      if (options.individual) {
        if (options.amend) {
          console.log(chalk.red("Error: --amend cannot be used with --individual"));
          process.exit(1);
        }
        await handleIndividualCommits(backend, cfg, commitOptions);
      } else {
        await handleSingleCommit(backend, cfg, commitOptions);
      }

      // Don't push in dry-run mode or amend mode
      if (options.push && !options.dryRun && !options.amend) {
        try {
          push();
          console.log(chalk.green("✓ Changes pushed to remote."));
        } catch (e) {
          const error = e as GitError;
          console.log(chalk.red(`Error pushing: ${error.message}`));
          process.exit(1);
        }
      }
    });

  program
    .command("config")
    .description("Show or edit configuration")
    .option("-e, --edit", "Create/edit configuration file")
    .option("-s, --set <key=value>", "Set a config value (e.g., --set backend=llamacpp)")
    .option("-l, --list-keys", "List all valid config keys")
    .action((options) => {
      // List valid keys
      if (options.listKeys) {
        console.log(chalk.bold("Valid config keys:"));
        for (const key of VALID_CONFIG_KEYS) {
          // Find alias for this key
          const alias = Object.entries(CONFIG_ALIASES).find(([, v]) => v === key)?.[0];
          if (alias) {
            console.log(`  ${key} ${chalk.dim(`(alias: ${alias})`)}`);
          } else {
            console.log(`  ${key}`);
          }
        }
        console.log();
        console.log(chalk.bold("Short aliases:"));
        for (const [alias, fullKey] of Object.entries(CONFIG_ALIASES)) {
          console.log(`  ${alias} → ${fullKey}`);
        }
        return;
      }

      // Set a config value
      if (options.set) {
        const match = options.set.match(/^([^=]+)=(.*)$/);
        if (!match) {
          console.log(chalk.red("Error: Invalid format. Use: --set key=value"));
          console.log(chalk.dim("Example: git-commit-ai config --set backend=llamacpp"));
          process.exit(1);
        }

        const [, key, value] = match;
        const result = updateConfig(key, value);

        if (result.success) {
          console.log(chalk.green(`✓ ${result.message}`));
        } else {
          console.log(chalk.red(`Error: ${result.message}`));
          process.exit(1);
        }
        return;
      }

      const cfg = loadConfig();

      if (options.edit) {
        console.log(chalk.dim("Creating default config file..."));
        saveConfig(cfg);
        console.log(chalk.green(`Config saved to: ${getConfigPath()}`));
        console.log(chalk.dim("Edit this file to customize settings."));
      } else {
        console.log(showConfig(cfg));
      }
    });

  program
    .command("summarize")
    .description("Summarize staged changes in plain English")
    .option("--diff", "Also show the raw diff")
    .option("-b, --backend <backend>", "Backend to use (ollama, openai, anthropic, groq, llamacpp)")
    .option("-d, --debug", "Enable debug output")
    .action(async (options) => {
      if (options.debug) {
        enableDebug();
      }

      const cfg = loadConfig();

      // Override backend if specified
      if (options.backend) {
        const validBackends: BackendType[] = ["ollama", "openai", "anthropic", "groq", "llamacpp"];
        if (validBackends.includes(options.backend)) {
          cfg.backend = options.backend;
          cfg.model = DEFAULT_MODELS[cfg.backend];
        }
      }

      // Auto-detect backend
      if (cfg.backend === "ollama") {
        const detected = await detectBackend();
        if (detected !== "ollama") {
          cfg.backend = detected;
          cfg.model = DEFAULT_MODELS[detected];
        }
      }

      const backend = createBackend(cfg);

      const available = await backend.isAvailable();
      if (!available) {
        if (cfg.backend === "ollama") {
          console.log(chalk.red("Error: Ollama is not running."));
          console.log(chalk.dim("Start it with: brew services start ollama"));
        } else {
          console.log(chalk.red(`Error: ${cfg.backend} backend is not available.`));
        }
        process.exit(1);
      }

      const diffResult = getStagedDiff();

      if (diffResult.isEmpty) {
        console.log(chalk.yellow("No staged changes to summarize."));
        console.log(chalk.dim("Stage changes with: git add <files>"));
        process.exit(0);
      }

      debugDiff(diffResult.diff, diffResult.files);

      console.log(chalk.bold(`\nFiles to summarize: ${diffResult.files.length}`));
      for (const f of diffResult.files.slice(0, 10)) {
        console.log(`  • ${f}`);
      }
      if (diffResult.files.length > 10) {
        console.log(`  ... and ${diffResult.files.length - 10} more`);
      }

      const context = buildDiffContext(diffResult);
      const prompt = buildSummarizePrompt(diffResult.diff, context);
      debugPrompt(prompt);

      const spinner = ora("Generating summary...").start();

      try {
        const summary = await backend.generate(prompt, cfg.temperature);
        spinner.stop();
        debugResponse(summary);

        console.log();
        console.log(chalk.blue("┌─") + chalk.blue("─".repeat(68)) + chalk.blue("─┐"));
        console.log(chalk.blue("│") + chalk.bold(" 📋 Summary") + " ".repeat(58) + chalk.blue("│"));
        console.log(chalk.blue("├─") + chalk.blue("─".repeat(68)) + chalk.blue("─┤"));
        for (const line of summary.trim().split("\n")) {
          console.log(chalk.blue("│") + "  " + line.padEnd(67) + chalk.blue("│"));
        }
        console.log(chalk.blue("└─") + chalk.blue("─".repeat(68)) + chalk.blue("─┘"));

        if (options.diff) {
          console.log();
          console.log(chalk.dim("┌─ 📄 Diff ─────────────────────────────────────────────────────────┐"));
          console.log(chalk.dim(diffResult.diff));
          console.log(chalk.dim("└───────────────────────────────────────────────────────────────────┘"));
        }
      } catch (e) {
        spinner.stop();
        const error = e as Error;
        debug(`Summary generation error: ${error.message}`);
        console.log(chalk.red(`Error generating summary: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command("hook")
    .description("Manage git hook for automatic commit message generation")
    .option("--install", "Install git hook")
    .option("--remove", "Remove git hook")
    .option("--status", "Check hook status")
    .action((options) => {
      const showStatus = !options.install && !options.remove;

      if (showStatus || options.status) {
        if (isHookInstalled()) {
          console.log(chalk.green("✓ git-commit-ai hook is installed"));
        } else {
          console.log(chalk.yellow("✗ git-commit-ai hook is not installed"));
          console.log(chalk.dim("Install with: git-commit-ai hook --install"));
        }
        return;
      }

      if (options.install) {
        const result = installHook();
        if (result.success) {
          console.log(chalk.green(`✓ ${result.message}`));
          console.log(chalk.dim("Now 'git commit' will auto-generate messages!"));
        } else {
          console.log(chalk.red(`✗ ${result.message}`));
          process.exit(1);
        }
        return;
      }

      if (options.remove) {
        const result = removeHook();
        if (result.success) {
          console.log(chalk.green(`✓ ${result.message}`));
        } else {
          console.log(chalk.red(`✗ ${result.message}`));
          process.exit(1);
        }
      }
    });

  return program;
}
