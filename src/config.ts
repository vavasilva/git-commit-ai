import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { Config, BackendType } from "./types.js";

const DEFAULT_CONFIG: Config = {
  backend: "ollama",
  model: "llama3.1:8b",
  ollama_url: "http://localhost:11434",
  openai_base_url: "https://api.openai.com/v1",
  temperature: 0.7,
  retry_temperatures: [0.5, 0.3, 0.2],
  ignore_patterns: [],
};

const VALID_BACKENDS: BackendType[] = ["ollama", "openai", "anthropic", "groq"];
const LOCAL_CONFIG_NAMES = [".gitcommitai", ".gitcommitai.toml"];

export function getConfigPath(): string {
  return join(homedir(), ".config", "git-commit-ai", "config.toml");
}

export function getLocalConfigPath(): string | null {
  for (const name of LOCAL_CONFIG_NAMES) {
    if (existsSync(name)) {
      return name;
    }
  }
  return null;
}

function parseConfigFile(path: string): Partial<Config> | null {
  try {
    const content = readFileSync(path, "utf-8");
    return parseToml(content) as Partial<Config>;
  } catch {
    return null;
  }
}

function mergeConfigs(base: Config, override: Partial<Config>): Config {
  return {
    backend: (VALID_BACKENDS.includes(override.backend as BackendType) ? override.backend : base.backend) as BackendType,
    model: override.model ?? base.model,
    ollama_url: override.ollama_url ?? base.ollama_url,
    openai_base_url: override.openai_base_url ?? base.openai_base_url,
    temperature: override.temperature ?? base.temperature,
    retry_temperatures: override.retry_temperatures ?? base.retry_temperatures,
    ignore_patterns: override.ignore_patterns ?? base.ignore_patterns,
    default_scope: override.default_scope ?? base.default_scope,
    default_type: override.default_type ?? base.default_type,
    default_language: override.default_language ?? base.default_language,
  };
}

export function loadConfig(): Config {
  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Load global config
  const globalPath = getConfigPath();
  if (existsSync(globalPath)) {
    const globalData = parseConfigFile(globalPath);
    if (globalData) {
      config = mergeConfigs(config, globalData);
    }
  }

  // Load local config (overrides global)
  const localPath = getLocalConfigPath();
  if (localPath) {
    const localData = parseConfigFile(localPath);
    if (localData) {
      config = mergeConfigs(config, localData);
    }
  }

  return config;
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = `# git-commit-ai configuration
# Backend: ollama, openai, anthropic, groq
backend = "${config.backend}"
model = "${config.model}"
ollama_url = "${config.ollama_url}"
# OpenAI Base URL - change this to use OpenAI-compatible APIs like llama.cpp
# Example: http://localhost:8080/v1 for llama-server
openai_base_url = "${config.openai_base_url}"
temperature = ${config.temperature}
retry_temperatures = [${config.retry_temperatures.join(", ")}]
`;

  writeFileSync(configPath, content, "utf-8");
}

export function showConfig(config: Config): string {
  const localPath = getLocalConfigPath();
  let output = `Configuration:
  Backend: ${config.backend}
  Model: ${config.model}
  Ollama URL: ${config.ollama_url}
  OpenAI Base URL: ${config.openai_base_url}
  Temperature: ${config.temperature}
  Retry temperatures: [${config.retry_temperatures.join(", ")}]`;

  if (config.ignore_patterns && config.ignore_patterns.length > 0) {
    output += `\n  Ignore patterns: [${config.ignore_patterns.join(", ")}]`;
  }
  if (config.default_scope) {
    output += `\n  Default scope: ${config.default_scope}`;
  }
  if (config.default_type) {
    output += `\n  Default type: ${config.default_type}`;
  }
  if (config.default_language) {
    output += `\n  Default language: ${config.default_language}`;
  }

  output += `\n  Global config: ${getConfigPath()}`;
  if (localPath) {
    output += `\n  Local config: ${localPath}`;
  }

  return output;
}
