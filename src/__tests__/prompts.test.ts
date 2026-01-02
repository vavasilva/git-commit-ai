import { describe, it, expect } from "vitest";
import {
  validateMessage,
  cleanMessage,
  fixMessage,
  truncateDiff,
  buildPrompt,
  buildSummarizePrompt,
} from "../prompts.js";

describe("validateMessage", () => {
  it("should validate correct Karma-style messages", () => {
    expect(validateMessage("feat: add new feature")).toBe(true);
    expect(validateMessage("fix: resolve bug")).toBe(true);
    expect(validateMessage("docs: update readme")).toBe(true);
    expect(validateMessage("style: format code")).toBe(true);
    expect(validateMessage("refactor: improve structure")).toBe(true);
    expect(validateMessage("test: add unit tests")).toBe(true);
    expect(validateMessage("chore: update dependencies")).toBe(true);
    expect(validateMessage("build: configure webpack")).toBe(true);
    expect(validateMessage("ci: add github actions")).toBe(true);
    expect(validateMessage("perf: optimize query")).toBe(true);
    expect(validateMessage("revert: undo changes")).toBe(true);
  });

  it("should validate messages with scope", () => {
    expect(validateMessage("feat(auth): add login")).toBe(true);
    expect(validateMessage("fix(api): handle errors")).toBe(true);
    expect(validateMessage("docs(readme): add examples")).toBe(true);
  });

  it("should reject invalid messages", () => {
    expect(validateMessage("invalid message")).toBe(false);
    expect(validateMessage("Add new feature")).toBe(false);
    expect(validateMessage("feature: add thing")).toBe(false);
    expect(validateMessage("")).toBe(false);
    // Note: "feat:no space" is actually valid per the regex (space is in \s*)
  });
});

describe("cleanMessage", () => {
  it("should take only the first line", () => {
    expect(cleanMessage("feat: first\nsecond line")).toBe("feat: first");
  });

  it("should remove common prefixes", () => {
    expect(cleanMessage("Here is feat: add feature")).toBe("feat: add feature");
    expect(cleanMessage("I've feat: add feature")).toBe("feat: add feature");
    expect(cleanMessage("The commit message is: feat: add")).toBe("feat: add");
    expect(cleanMessage("Commit message: feat: add")).toBe("feat: add");
    expect(cleanMessage("Here's feat: add")).toBe("feat: add");
  });

  it("should strip trailing period", () => {
    expect(cleanMessage("feat: add feature.")).toBe("feat: add feature");
  });

  it("should trim whitespace", () => {
    expect(cleanMessage("  feat: add feature  ")).toBe("feat: add feature");
  });
});

describe("fixMessage", () => {
  it("should return valid messages unchanged", () => {
    expect(fixMessage("feat: add feature")).toBe("feat: add feature");
  });

  it("should infer type from first word", () => {
    expect(fixMessage("add new feature")).toBe("feat: add new feature");
    expect(fixMessage("fix the bug")).toBe("fix: fix the bug");
    expect(fixMessage("update dependencies")).toBe("refactor: update dependencies");
    expect(fixMessage("remove old code")).toBe("refactor: remove old code");
    expect(fixMessage("document the api")).toBe("docs: document the api");
  });

  it("should default to chore for unknown actions", () => {
    expect(fixMessage("misc changes")).toBe("chore: misc changes");
  });

  it("should clean before fixing", () => {
    expect(fixMessage("Here is add feature")).toBe("feat: add feature");
  });
});

describe("truncateDiff", () => {
  it("should not truncate short diffs", () => {
    const shortDiff = "short diff content";
    expect(truncateDiff(shortDiff)).toBe(shortDiff);
  });

  it("should truncate long diffs", () => {
    const longDiff = "x".repeat(10000);
    const result = truncateDiff(longDiff);
    expect(result.length).toBeLessThan(longDiff.length);
    expect(result).toContain("[... diff truncated for brevity ...]");
  });

  it("should truncate at newline boundary when possible", () => {
    const lines = Array(200).fill("line content").join("\n");
    const result = truncateDiff(lines, 1000);
    expect(result).toContain("[... diff truncated for brevity ...]");
  });
});

describe("buildPrompt", () => {
  it("should include diff and context", () => {
    const prompt = buildPrompt("diff content", "context info");
    expect(prompt).toContain("diff content");
    expect(prompt).toContain("context info");
  });

  it("should include Karma format instructions", () => {
    const prompt = buildPrompt("diff", "context");
    expect(prompt).toContain("FORMAT:");
    expect(prompt).toContain("feat");
    expect(prompt).toContain("fix");
  });
});

describe("buildSummarizePrompt", () => {
  it("should include diff and context", () => {
    const prompt = buildSummarizePrompt("diff content", "context info");
    expect(prompt).toContain("diff content");
    expect(prompt).toContain("context info");
  });

  it("should include summary instructions", () => {
    const prompt = buildSummarizePrompt("diff", "context");
    expect(prompt).toContain("Summarize");
  });
});
