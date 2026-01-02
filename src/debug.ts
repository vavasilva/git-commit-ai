import chalk from "chalk";
import type { Config } from "./types.js";

let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

function getTimestamp(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export function debug(message: string, data?: string): void {
  if (!debugEnabled) return;

  console.error(chalk.dim(`[${getTimestamp()}]`), chalk.cyan("[DEBUG]"), message);

  if (data) {
    const truncated =
      data.length > 500 ? data.slice(0, 500) + `\n... (${data.length} chars total, truncated)` : data;
    console.error(chalk.dim(truncated));
  }
}

export function debugConfig(cfg: Config): void {
  debug(
    "Config loaded:",
    `
  Model: ${cfg.model}
  Ollama URL: ${cfg.ollama_url}
  Temperature: ${cfg.temperature}
  Retry temps: [${cfg.retry_temperatures.join(", ")}]`
  );
}

export function debugDiff(diff: string, files: string[]): void {
  const filesList = files.slice(0, 5).join(", ") + (files.length > 5 ? " ..." : "");
  debug(`Diff size: ${diff.length} chars, Files: ${files.length}`, `Files: ${filesList}`);
}

export function debugPrompt(prompt: string): void {
  const truncated = prompt.length > 500 ? prompt.slice(0, 500) + "..." : prompt;
  debug("Prompt to LLM:", truncated);
}

export function debugResponse(response: string): void {
  debug("Raw LLM response:", response);
}

export function debugValidation(message: string, isValid: boolean, fixed?: string): void {
  const status = isValid ? chalk.green("valid") : chalk.red("invalid");
  debug(`Message validation: ${status}`, message);
  if (fixed && fixed !== message) {
    debug("Fixed message:", fixed);
  }
}
