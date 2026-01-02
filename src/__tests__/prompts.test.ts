import { describe, it, expect } from "vitest";
import {
  validateMessage,
  cleanMessage,
  fixMessage,
  truncateDiff,
  buildPrompt,
  buildSummarizePrompt,
  isValidType,
  getValidTypes,
  addIssueReference,
  addCoAuthors,
  ensureBreakingMarker,
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

describe("isValidType", () => {
  it("should accept valid commit types", () => {
    expect(isValidType("feat")).toBe(true);
    expect(isValidType("fix")).toBe(true);
    expect(isValidType("docs")).toBe(true);
    expect(isValidType("style")).toBe(true);
    expect(isValidType("refactor")).toBe(true);
    expect(isValidType("test")).toBe(true);
    expect(isValidType("chore")).toBe(true);
    expect(isValidType("build")).toBe(true);
    expect(isValidType("ci")).toBe(true);
    expect(isValidType("perf")).toBe(true);
    expect(isValidType("revert")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isValidType("FEAT")).toBe(true);
    expect(isValidType("Fix")).toBe(true);
  });

  it("should reject invalid types", () => {
    expect(isValidType("feature")).toBe(false);
    expect(isValidType("bugfix")).toBe(false);
    expect(isValidType("update")).toBe(false);
    expect(isValidType("")).toBe(false);
  });
});

describe("getValidTypes", () => {
  it("should return array of valid types", () => {
    const types = getValidTypes();
    expect(types).toContain("feat");
    expect(types).toContain("fix");
    expect(types.length).toBeGreaterThan(0);
  });
});

describe("addIssueReference", () => {
  it("should add issue reference to message", () => {
    const result = addIssueReference("feat: add feature", "123");
    expect(result).toBe("feat: add feature\n\nRefs: #123");
  });

  it("should handle issue with # prefix", () => {
    const result = addIssueReference("feat: add feature", "#456");
    expect(result).toBe("feat: add feature\n\nRefs: #456");
  });
});

describe("addCoAuthors", () => {
  it("should add single co-author", () => {
    const result = addCoAuthors("feat: add feature", ["John Doe <john@example.com>"]);
    expect(result).toBe("feat: add feature\n\nCo-authored-by: John Doe <john@example.com>");
  });

  it("should add multiple co-authors", () => {
    const result = addCoAuthors("feat: add feature", [
      "John Doe <john@example.com>",
      "Jane Doe <jane@example.com>",
    ]);
    expect(result).toContain("Co-authored-by: John Doe <john@example.com>");
    expect(result).toContain("Co-authored-by: Jane Doe <jane@example.com>");
  });

  it("should return original message if no co-authors", () => {
    const result = addCoAuthors("feat: add feature", []);
    expect(result).toBe("feat: add feature");
  });
});

describe("ensureBreakingMarker", () => {
  it("should add ! to message without scope", () => {
    const result = ensureBreakingMarker("feat: add feature");
    expect(result).toBe("feat!: add feature");
  });

  it("should add ! to message with scope", () => {
    const result = ensureBreakingMarker("feat(api): add feature");
    expect(result).toBe("feat(api)!: add feature");
  });

  it("should not duplicate ! if already present", () => {
    const result = ensureBreakingMarker("feat!: add feature");
    expect(result).toBe("feat!: add feature");
  });
});

describe("buildPrompt with constraints", () => {
  it("should include type constraint", () => {
    const prompt = buildPrompt("diff", "context", { type: "fix" });
    expect(prompt).toContain('CONSTRAINT: You MUST use "fix" as the commit type');
  });

  it("should include scope constraint", () => {
    const prompt = buildPrompt("diff", "context", { scope: "auth" });
    expect(prompt).toContain('CONSTRAINT: You MUST use "(auth)" as the scope');
  });

  it("should include breaking constraint", () => {
    const prompt = buildPrompt("diff", "context", { breaking: true });
    expect(prompt).toContain("BREAKING CHANGE");
  });

  it("should include language constraint", () => {
    const prompt = buildPrompt("diff", "context", { language: "pt" });
    expect(prompt).toContain("Portuguese");
  });

  it("should include additional context", () => {
    const prompt = buildPrompt("diff", "context", { context: "This fixes the login bug" });
    expect(prompt).toContain("ADDITIONAL CONTEXT: This fixes the login bug");
  });

  it("should work without constraints", () => {
    const prompt = buildPrompt("diff", "context");
    expect(prompt).toContain("diff");
    expect(prompt).toContain("context");
  });
});
