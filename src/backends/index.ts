import type { Backend, BackendType, Config } from "../types.js";
import { OllamaBackend } from "./ollama.js";
import { OpenAIBackend } from "./openai.js";
import { AnthropicBackend } from "./anthropic.js";
import { GroqBackend } from "./groq.js";

export { OllamaBackend } from "./ollama.js";
export { OpenAIBackend } from "./openai.js";
export { AnthropicBackend } from "./anthropic.js";
export { GroqBackend } from "./groq.js";
export type { Backend };

/**
 * Default models for each backend
 */
export const DEFAULT_MODELS: Record<BackendType, string> = {
  ollama: "llama3.1:8b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  groq: "llama-3.1-8b-instant",
};

/**
 * Create a backend instance based on configuration
 */
export function createBackend(config: Config): Backend {
  const model = config.model || DEFAULT_MODELS[config.backend];

  switch (config.backend) {
    case "openai":
      return new OpenAIBackend(model, undefined, config.openai_base_url);
    case "anthropic":
      return new AnthropicBackend(model);
    case "groq":
      return new GroqBackend(model);
    case "ollama":
    default:
      return new OllamaBackend(model, config.ollama_url);
  }
}

/**
 * Auto-detect the best available backend based on API keys
 * Priority: Ollama (local) > OpenAI with custom URL (llama.cpp) > Groq (fast) > OpenAI > Anthropic
 */
export async function detectBackend(): Promise<BackendType> {
  // First try Ollama (local, no API key needed)
  const ollama = new OllamaBackend();
  if (await ollama.isAvailable()) {
    return "ollama";
  }

  // Check for OpenAI-compatible local server (llama.cpp, etc.)
  if (OpenAIBackend.hasCustomBaseUrl()) {
    const localOpenai = new OpenAIBackend();
    if (await localOpenai.isAvailable()) {
      return "openai";
    }
  }

  // Then check for cloud API keys
  if (GroqBackend.hasApiKey()) {
    return "groq";
  }

  if (OpenAIBackend.hasApiKey()) {
    return "openai";
  }

  if (AnthropicBackend.hasApiKey()) {
    return "anthropic";
  }

  // Default to ollama even if not available (will show error later)
  return "ollama";
}

/**
 * Check which backends have API keys configured
 */
export function getAvailableBackends(): BackendType[] {
  const available: BackendType[] = ["ollama"]; // Always available (local)

  // OpenAI is available with API key OR with custom base URL (llama.cpp, etc.)
  if (OpenAIBackend.isConfigured()) {
    available.push("openai");
  }

  if (AnthropicBackend.hasApiKey()) {
    available.push("anthropic");
  }

  if (GroqBackend.hasApiKey()) {
    available.push("groq");
  }

  return available;
}
