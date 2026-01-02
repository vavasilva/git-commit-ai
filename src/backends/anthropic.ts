import type { Backend } from "../types.js";

export class AnthropicBackend implements Backend {
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(
    model = "claude-3-haiku-20240307",
    apiKey?: string,
    baseUrl = "https://api.anthropic.com"
  ) {
    this.model = model;
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content?.find((block) => block.type === "text");
    return textBlock?.text ?? "";
  }

  async isAvailable(): Promise<boolean> {
    // Anthropic doesn't have a simple health check endpoint
    // Just check if API key is set
    return !!this.apiKey;
  }

  static hasApiKey(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}
