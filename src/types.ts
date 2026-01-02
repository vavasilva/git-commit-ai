export type BackendType = "ollama" | "openai" | "anthropic" | "groq";

export interface Config {
  backend: BackendType;
  model: string;
  ollama_url: string;
  temperature: number;
  retry_temperatures: number[];
}

export interface DiffResult {
  diff: string;
  stats: string;
  files: string[];
  isEmpty: boolean;
}

export interface Backend {
  generate(prompt: string, temperature?: number): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface HookResult {
  success: boolean;
  message: string;
}
