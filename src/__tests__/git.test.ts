import { describe, it, expect } from "vitest";
import { shouldIgnoreFile, filterDiffByPatterns } from "../git.js";

describe("shouldIgnoreFile", () => {
  it("should match exact filename patterns", () => {
    expect(shouldIgnoreFile("package-lock.json", ["package-lock.json"])).toBe(true);
    expect(shouldIgnoreFile("yarn.lock", ["yarn.lock"])).toBe(true);
  });

  it("should match glob patterns with *", () => {
    expect(shouldIgnoreFile("file.lock", ["*.lock"])).toBe(true);
    expect(shouldIgnoreFile("package-lock.json", ["*.lock"])).toBe(false);
    expect(shouldIgnoreFile("test.min.js", ["*.min.js"])).toBe(true);
  });

  it("should match directory patterns with **", () => {
    expect(shouldIgnoreFile("dist/index.js", ["dist/**"])).toBe(true);
    expect(shouldIgnoreFile("dist/nested/file.js", ["dist/**"])).toBe(true);
    expect(shouldIgnoreFile("src/index.js", ["dist/**"])).toBe(false);
  });

  it("should match patterns anywhere in path", () => {
    expect(shouldIgnoreFile("src/node_modules/package/index.js", ["node_modules"])).toBe(true);
    expect(shouldIgnoreFile("node_modules/package/index.js", ["node_modules"])).toBe(true);
  });

  it("should return false if no patterns match", () => {
    expect(shouldIgnoreFile("src/index.ts", ["*.lock", "dist/**"])).toBe(false);
  });

  it("should handle empty patterns array", () => {
    expect(shouldIgnoreFile("any-file.ts", [])).toBe(false);
  });
});

describe("filterDiffByPatterns", () => {
  const sampleDiff = `diff --git a/package-lock.json b/package-lock.json
index 1234567..abcdefg 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,5 @@
 some lock file content
diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,5 @@
 some source code
diff --git a/dist/bundle.js b/dist/bundle.js
index 1234567..abcdefg 100644
--- a/dist/bundle.js
+++ b/dist/bundle.js
@@ -1,5 +1,5 @@
 some bundled code`;

  it("should filter out files matching patterns", () => {
    const result = filterDiffByPatterns(sampleDiff, ["package-lock.json"]);
    expect(result).not.toContain("package-lock.json");
    expect(result).toContain("src/index.ts");
    expect(result).toContain("dist/bundle.js");
  });

  it("should filter multiple patterns", () => {
    const result = filterDiffByPatterns(sampleDiff, ["package-lock.json", "dist/**"]);
    expect(result).not.toContain("package-lock.json");
    expect(result).not.toContain("dist/bundle.js");
    expect(result).toContain("src/index.ts");
  });

  it("should return original diff if no patterns", () => {
    const result = filterDiffByPatterns(sampleDiff, []);
    expect(result).toBe(sampleDiff);
  });

  it("should return original diff if patterns is undefined", () => {
    // @ts-expect-error - testing undefined input
    const result = filterDiffByPatterns(sampleDiff, undefined);
    expect(result).toBe(sampleDiff);
  });
});
