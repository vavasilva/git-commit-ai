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
 * Default URL for llama.cpp server
 */
export const LLAMACPP_DEFAULT_URL = "http://localhost:8080/v1";

/**
 * Default models for each backend
 */
export const DEFAULT_MODELS: Record<BackendType, string> = {
  ollama: "llama3.1:8b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  groq: "llama-3.1-8b-instant",
  llamacpp: "gpt-4o-mini", // Model alias used by llama-server (--alias flag)
};

/**
 * Create a backend instance based on configuration
 */
export function createBackend(config: Config): Backend {
  const model = config.model || DEFAULT_MODELS[config.backend];

  switch (config.backend) {
    case "openai":
      return new OpenAIBackend(model, undefined, config.openai_base_url);
    case "llamacpp":
      // llamacpp uses OpenAI-compatible API with default localhost:8080
      return new OpenAIBackend(model, undefined, LLAMACPP_DEFAULT_URL);
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
 * Priority: Ollama (local) > llama.cpp (local) > OpenAI with custom URL > Groq (fast) > OpenAI > Anthropic
 */
export async function detectBackend(): Promise<BackendType> {
  // First try Ollama (local, no API key needed)
  const ollama = new OllamaBackend();
  if (await ollama.isAvailable()) {
    return "ollama";
  }

  // Try llama.cpp on default port (localhost:8080)
  const llamacpp = new OpenAIBackend(DEFAULT_MODELS.llamacpp, undefined, LLAMACPP_DEFAULT_URL);
  if (await llamacpp.isAvailable()) {
    return "llamacpp";
  }

  // Check for OpenAI-compatible local server with custom URL
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
  const available: BackendType[] = ["ollama", "llamacpp"]; // Local backends always listed

  // OpenAI is available with API key OR with custom base URL
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
