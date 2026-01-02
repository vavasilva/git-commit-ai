import type { Backend } from "../types.js";

export class OllamaBackend implements Backend {
  private model: string;
  private baseUrl: string;

  constructor(model = "llama3.1:8b", baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, temperature = 0.7): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    return data.response ?? "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async hasModel(model?: string): Promise<boolean> {
    const checkModel = model ?? this.model;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status !== 200) {
        return false;
      }

      const data = (await response.json()) as {
        models?: Array<{ name?: string }>;
      };
      const models = data.models?.map((m) => m.name ?? "") ?? [];
      return models.some((m) => m.includes(checkModel));
    } catch {
      return false;
    }
  }
}
