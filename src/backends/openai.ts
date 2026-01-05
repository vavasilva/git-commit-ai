import type { Backend } from "../types.js";

const OPENAI_DEFAULT_URL = "https://api.openai.com/v1";

export class OpenAIBackend implements Backend {
  private model: string;
  private apiKey: string;
  private baseUrl: string;
  private isLocalServer: boolean;

  constructor(model = "gpt-4o-mini", apiKey?: string, baseUrl?: string) {
    this.model = model;
    // Priority: constructor arg > OPENAI_BASE_URL env > default
    this.baseUrl = baseUrl ?? process.env.OPENAI_BASE_URL ?? OPENAI_DEFAULT_URL;
    // Check if this is a local server (llama.cpp, etc.)
    this.isLocalServer = this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1");
    // For local servers, API key is optional (use dummy if not set)
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? (this.isLocalServer ? "no-key-required" : "");
  }

  async generate(prompt: string, temperature = 0.7): Promise<string> {
    if (!this.apiKey && !this.isLocalServer) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? "";
  }

  async isAvailable(): Promise<boolean> {
    // For non-local servers, require API key
    if (!this.apiKey && !this.isLocalServer) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if OpenAI API key is configured or if a custom base URL is set
   */
  static hasApiKey(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Check if a custom base URL is configured (for llama.cpp, etc.)
   */
  static hasCustomBaseUrl(): boolean {
    return !!process.env.OPENAI_BASE_URL;
  }

  /**
   * Check if this backend can potentially work (has API key or custom URL)
   */
  static isConfigured(): boolean {
    return OpenAIBackend.hasApiKey() || OpenAIBackend.hasCustomBaseUrl();
  }
}
