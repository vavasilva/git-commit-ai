import { describe, it, expect, vi, beforeEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock the fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadConfig, saveConfig, getConfigPath, getLocalConfigPath, showConfig } from "../config.js";

describe("getConfigPath", () => {
  it("should return path in home .config directory", () => {
    const path = getConfigPath();
    expect(path).toBe(join(homedir(), ".config", "git-commit-ai", "config.toml"));
  });
});

describe("loadConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return default config when file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config).toEqual({
      backend: "ollama",
      model: "llama3.1:8b",
      ollama_url: "http://localhost:11434",
      openai_base_url: "https://api.openai.com/v1",
      temperature: 0.7,
      retry_temperatures: [0.5, 0.3, 0.2],
      ignore_patterns: [],
    });
  });

  it("should load and parse config from file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(`
model = "custom-model"
ollama_url = "http://custom:1234"
temperature = 0.5
retry_temperatures = [0.4, 0.3]
`);

    const config = loadConfig();

    expect(config.model).toBe("custom-model");
    expect(config.ollama_url).toBe("http://custom:1234");
    expect(config.temperature).toBe(0.5);
    expect(config.retry_temperatures).toEqual([0.4, 0.3]);
  });

  it("should use defaults for missing fields", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(`model = "custom-model"`);

    const config = loadConfig();

    expect(config.model).toBe("custom-model");
    expect(config.ollama_url).toBe("http://localhost:11434");
    expect(config.temperature).toBe(0.7);
    expect(config.retry_temperatures).toEqual([0.5, 0.3, 0.2]);
  });

  it("should return defaults on parse error", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("invalid toml {{{}}}");

    const config = loadConfig();

    expect(config.model).toBe("llama3.1:8b");
  });
});

describe("saveConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should create directory if it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    saveConfig({
      backend: "ollama",
      model: "test",
      ollama_url: "http://test",
      temperature: 0.5,
      retry_temperatures: [0.3],
    });

    expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should write config in TOML format", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    saveConfig({
      backend: "openai",
      model: "test-model",
      ollama_url: "http://test:1234",
      temperature: 0.5,
      retry_temperatures: [0.4, 0.3],
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('model = "test-model"'),
      "utf-8"
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('ollama_url = "http://test:1234"'),
      "utf-8"
    );
  });
});

describe("showConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should format config for display", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const output = showConfig({
      backend: "ollama",
      model: "test-model",
      ollama_url: "http://test:1234",
      temperature: 0.5,
      retry_temperatures: [0.4, 0.3],
    });

    expect(output).toContain("test-model");
    expect(output).toContain("http://test:1234");
    expect(output).toContain("0.5");
    expect(output).toContain("0.4, 0.3");
  });

  it("should show ignore patterns if present", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const output = showConfig({
      backend: "ollama",
      model: "test-model",
      ollama_url: "http://test:1234",
      temperature: 0.5,
      retry_temperatures: [0.4, 0.3],
      ignore_patterns: ["*.lock", "dist/**"],
    });

    expect(output).toContain("Ignore patterns");
    expect(output).toContain("*.lock");
    expect(output).toContain("dist/**");
  });

  it("should show default scope/type/language if present", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const output = showConfig({
      backend: "ollama",
      model: "test-model",
      ollama_url: "http://test:1234",
      temperature: 0.5,
      retry_temperatures: [0.4, 0.3],
      default_scope: "api",
      default_type: "feat",
      default_language: "pt",
    });

    expect(output).toContain("Default scope: api");
    expect(output).toContain("Default type: feat");
    expect(output).toContain("Default language: pt");
  });
});

describe("getLocalConfigPath", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return null if no local config exists", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(getLocalConfigPath()).toBe(null);
  });

  it("should return .gitcommitai if it exists", () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return path === ".gitcommitai";
    });
    expect(getLocalConfigPath()).toBe(".gitcommitai");
  });

  it("should return .gitcommitai.toml if it exists", () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return path === ".gitcommitai.toml";
    });
    expect(getLocalConfigPath()).toBe(".gitcommitai.toml");
  });
});

describe("loadConfig with local config", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should merge local config with global config", () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      if (typeof path === "string") {
        return path.includes("config.toml") || path === ".gitcommitai";
      }
      return false;
    });

    vi.mocked(readFileSync).mockImplementation((path) => {
      if (typeof path === "string" && path.includes("config.toml")) {
        return `model = "global-model"\ntemperature = 0.7`;
      }
      if (path === ".gitcommitai") {
        return `model = "local-model"\nignore_patterns = ["*.lock"]`;
      }
      return "";
    });

    const config = loadConfig();

    // Local config should override global
    expect(config.model).toBe("local-model");
    // Global config value should be preserved
    expect(config.temperature).toBe(0.7);
    // Local-only value should be present
    expect(config.ignore_patterns).toEqual(["*.lock"]);
  });

  it("should load ignore_patterns from config", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(`
model = "test-model"
ignore_patterns = ["*.lock", "dist/**", "node_modules/**"]
`);

    const config = loadConfig();
    expect(config.ignore_patterns).toEqual(["*.lock", "dist/**", "node_modules/**"]);
  });
});
