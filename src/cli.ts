import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline";

import { loadConfig, saveConfig, showConfig, getConfigPath } from "./config.js";
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
  push,
  getStagedFiles,
  resetStaged,
  GitError,
} from "./git.js";
import {
  buildPrompt,
  buildSummarizePrompt,
  cleanMessage,
  validateMessage,
  fixMessage,
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
import type { Config, BackendType } from "./types.js";

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
  temperatures: number[]
): Promise<string | null> {
  const prompt = buildPrompt(diffContent, context);
  debugPrompt(prompt);

  for (const temp of temperatures) {
    debug(`Trying temperature: ${temp}`);
    try {
      const rawMessage = await backend.generate(prompt, temp);
      debugResponse(rawMessage);

      const message = cleanMessage(rawMessage);
      const isValid = validateMessage(message);
      debugValidation(message, isValid);

      if (isValid) {
        return message;
      }

      // Try to fix the message
      const fixed = fixMessage(message);
      if (validateMessage(fixed)) {
        debugValidation(fixed, true, fixed);
        return fixed;
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
  skipConfirm: boolean
): Promise<string | null> {
  const temperatures = [cfg.temperature, ...cfg.retry_temperatures];
  const spinner = ora("Generating commit message...").start();

  while (true) {
    let message: string | null;
    try {
      message = await generateMessage(backend, diffContent, context, temperatures);
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

async function handleSingleCommit(
  backend: Backend,
  cfg: Config,
  skipConfirm: boolean,
  dryRun: boolean = false
): Promise<void> {
  const diffResult = getStagedDiff();

  if (diffResult.isEmpty) {
    console.log(chalk.yellow("No changes to commit."));
    process.exit(0);
  }

  debugDiff(diffResult.diff, diffResult.files);
  const context = `Files changed:\n${diffResult.files.slice(0, 5).join("\n")}\nStats: ${diffResult.stats}`;

  const message = await runCommitFlow(backend, cfg, diffResult.diff, context, skipConfirm);

  if (message === null) {
    console.log(chalk.yellow("Aborted."));
    process.exit(0);
  }

  if (dryRun) {
    console.log(chalk.cyan("Dry run - message not committed:"));
    console.log(message);
    return;
  }

  try {
    commit(message);
    debug(`Commit successful: ${message}`);
    console.log(chalk.green("✓ Committed:"), message);
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
  skipConfirm: boolean,
  dryRun: boolean = false
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

    const context = `File: ${filePath}\nStats: ${diffResult.stats}`;
    const message = await runCommitFlow(backend, cfg, diffResult.diff, context, skipConfirm);

    if (message === null) {
      console.log(chalk.yellow(`Skipped: ${filePath}`));
      continue;
    }

    if (dryRun) {
      console.log(chalk.cyan(`Dry run - ${filePath}:`));
      console.log(message);
      continue;
    }

    try {
      commit(message);
      console.log(chalk.green("✓ Committed:"), message);
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
    .description("Generate commit messages using LLMs (Ollama, OpenAI, Anthropic, Groq)")
    .version("0.3.0")
    .option("-p, --push", "Push after commit")
    .option("-y, --yes", "Skip confirmation")
    .option("-i, --individual", "Commit files individually")
    .option("-d, --debug", "Enable debug output")
    .option("--dry-run", "Show generated message without committing")
    .option("-b, --backend <backend>", "Backend to use (ollama, openai, anthropic, groq)")
    .option("-m, --model <model>", "Override model from config")
    .option("-t, --temperature <temp>", "Override temperature (0.0-1.0)", parseFloat)
    .option("--hook-mode", "Called by git hook (outputs message only)")
    .action(async (options) => {
      if (options.debug) {
        enableDebug();
        debug("Debug mode enabled");
      }

      const cfg = loadConfig();

      // Override config with CLI options
      if (options.backend) {
        const validBackends: BackendType[] = ["ollama", "openai", "anthropic", "groq"];
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
        } else {
          console.log(chalk.red(`Error: ${cfg.backend} backend is not available.`));
          const envVar = {
            openai: "OPENAI_API_KEY",
            anthropic: "ANTHROPIC_API_KEY",
            groq: "GROQ_API_KEY",
          }[cfg.backend];
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

      // Hook mode: just output the message
      if (options.hookMode) {
        const diffResult = getStagedDiff();
        if (diffResult.isEmpty) {
          process.exit(1);
        }

        const context = `Files changed:\n${diffResult.files.slice(0, 5).join("\n")}\nStats: ${diffResult.stats}`;
        const temperatures = [cfg.temperature, ...cfg.retry_temperatures];
        const message = await generateMessage(backend, diffResult.diff, context, temperatures);

        if (message) {
          console.log(message);
          process.exit(0);
        }
        process.exit(1);
      }

      // Stage all files
      addFiles(".");

      if (options.individual) {
        await handleIndividualCommits(backend, cfg, options.yes, options.dryRun);
      } else {
        await handleSingleCommit(backend, cfg, options.yes, options.dryRun);
      }

      // Don't push in dry-run mode
      if (options.push && !options.dryRun) {
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
    .action((options) => {
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
    .option("-b, --backend <backend>", "Backend to use (ollama, openai, anthropic, groq)")
    .option("-d, --debug", "Enable debug output")
    .action(async (options) => {
      if (options.debug) {
        enableDebug();
      }

      const cfg = loadConfig();

      // Override backend if specified
      if (options.backend) {
        const validBackends: BackendType[] = ["ollama", "openai", "anthropic", "groq"];
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

      const context = `Files changed: ${diffResult.files.slice(0, 5).join(", ")}\nStats: ${diffResult.stats}`;
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
