import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { Config } from "./types.js";

const DEFAULT_CONFIG: Config = {
  model: "llama3.1:8b",
  ollama_url: "http://localhost:11434",
  temperature: 0.7,
  retry_temperatures: [0.5, 0.3, 0.2],
};

export function getConfigPath(): string {
  return join(homedir(), ".config", "git-commit-ai", "config.toml");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const data = parseToml(content) as Partial<Config>;

    return {
      model: data.model ?? DEFAULT_CONFIG.model,
      ollama_url: data.ollama_url ?? DEFAULT_CONFIG.ollama_url,
      temperature: data.temperature ?? DEFAULT_CONFIG.temperature,
      retry_temperatures:
        data.retry_temperatures ?? DEFAULT_CONFIG.retry_temperatures,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = `# git-commit-ai configuration
model = "${config.model}"
ollama_url = "${config.ollama_url}"
temperature = ${config.temperature}
retry_temperatures = [${config.retry_temperatures.join(", ")}]
`;

  writeFileSync(configPath, content, "utf-8");
}

export function showConfig(config: Config): string {
  return `Configuration:
  Model: ${config.model}
  Ollama URL: ${config.ollama_url}
  Temperature: ${config.temperature}
  Retry temperatures: [${config.retry_temperatures.join(", ")}]
  Config file: ${getConfigPath()}`;
}
