export type BackendType = "ollama" | "openai" | "anthropic" | "groq";

export interface Config {
  backend: BackendType;
  model: string;
  ollama_url: string;
  openai_base_url: string;
  temperature: number;
  retry_temperatures: number[];
  ignore_patterns?: string[];
  default_scope?: string;
  default_type?: string;
  default_language?: string;
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
