import type { Backend } from "../types.js";

export class OpenAIBackend implements Backend {
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(model = "gpt-4o-mini", apiKey?: string, baseUrl = "https://api.openai.com/v1") {
    this.model = model;
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
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
    if (!this.apiKey) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  static hasApiKey(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
}
