import { execSync } from "node:child_process";
import type { DiffResult } from "./types.js";

function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // Support: *, **, ?
  let regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<GLOBSTAR>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<GLOBSTAR>>/g, ".*")
    .replace(/\?/g, ".");

  // If pattern doesn't start with / or *, it can match anywhere in path
  if (!pattern.startsWith("/") && !pattern.startsWith("*")) {
    regexStr = `(^|/)${regexStr}`;
  }

  // Match end of string or after /
  regexStr = `${regexStr}($|/)`;

  try {
    const regex = new RegExp(regexStr);
    return regex.test(filePath);
  } catch {
    return false;
  }
}

export function shouldIgnoreFile(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(filePath, pattern));
}

export function filterDiffByPatterns(diff: string, patterns: string[]): string {
  if (!patterns || patterns.length === 0) {
    return diff;
  }

  // Split diff into file sections
  const sections = diff.split(/(?=^diff --git)/m);
  const filtered = sections.filter((section) => {
    // Extract file path from diff header
    const match = section.match(/^diff --git a\/(.+?) b\//m);
    if (!match) {
      return true; // Keep sections without proper header
    }
    const filePath = match[1];
    return !shouldIgnoreFile(filePath, patterns);
  });

  return filtered.join("");
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

function runGit(...args: string[]): string {
  try {
    const result = execSync(["git", ...args].join(" "), {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    const message = err.stderr?.trim() || err.message;
    throw new GitError(`Git command failed: ${message}`);
  }
}

function runGitSafe(...args: string[]): string {
  try {
    return runGit(...args);
  } catch {
    return "";
  }
}

export function getStagedDiff(): DiffResult {
  const diff = runGitSafe("diff", "--cached");
  const stats = runGitSafe("diff", "--cached", "--stat");
  const filesOutput = runGitSafe("diff", "--cached", "--name-only");
  const files = filesOutput.split("\n").filter((f) => f);

  return {
    diff,
    stats,
    files,
    isEmpty: !diff.trim(),
  };
}

export function getFileDiff(filePath: string): DiffResult {
  const diff = runGitSafe("diff", "--cached", "--", filePath);
  const stats = runGitSafe("diff", "--cached", "--stat", "--", filePath);
  const files = diff ? [filePath] : [];

  return {
    diff,
    stats,
    files,
    isEmpty: !diff.trim(),
  };
}

export function addFiles(...paths: string[]): boolean {
  if (paths.length === 0) {
    paths = ["."];
  }
  try {
    runGit("add", ...paths);
    return true;
  } catch (error) {
    const err = error as GitError;
    // Ignore "ignored file" errors and "pathspec did not match" (deleted files)
    if (
      err.message.includes("ignored by one of your .gitignore") ||
      err.message.includes("pathspec") && err.message.includes("did not match")
    ) {
      return false;
    }
    throw error;
  }
}

export function commit(message: string): string {
  runGit("commit", "-m", `"${message.replace(/"/g, '\\"')}"`);
  return runGit("rev-parse", "HEAD");
}

export function push(): void {
  const branch = getCurrentBranch();
  runGit("push", "origin", branch);
}

export function getCurrentBranch(): string {
  return runGit("rev-parse", "--abbrev-ref", "HEAD");
}

export function getModifiedFiles(): string[] {
  const files = new Set<string>();

  // Modified and staged files
  const staged = runGitSafe("diff", "--cached", "--name-only");
  if (staged) {
    staged.split("\n").forEach((f) => files.add(f));
  }

  // Modified but not staged
  const modified = runGitSafe("diff", "--name-only");
  if (modified) {
    modified.split("\n").forEach((f) => files.add(f));
  }

  // Untracked files
  const untracked = runGitSafe("ls-files", "--others", "--exclude-standard");
  if (untracked) {
    untracked.split("\n").forEach((f) => files.add(f));
  }

  return Array.from(files).filter((f) => f);
}

export function hasStagedChanges(): boolean {
  const diff = runGitSafe("diff", "--cached", "--name-only");
  return Boolean(diff.trim());
}

export function getStagedFiles(): string[] {
  const output = runGitSafe("diff", "--cached", "--name-only");
  return output.split("\n").filter((f) => f);
}

export function resetStaged(): void {
  runGitSafe("reset", "HEAD");
}

export function getLastCommitDiff(): DiffResult {
  const diff = runGitSafe("diff", "HEAD~1", "HEAD");
  const stats = runGitSafe("diff", "HEAD~1", "HEAD", "--stat");
  const filesOutput = runGitSafe("diff", "HEAD~1", "HEAD", "--name-only");
  const files = filesOutput.split("\n").filter((f) => f);

  return {
    diff,
    stats,
    files,
    isEmpty: !diff.trim(),
  };
}

export function commitAmend(message: string): string {
  runGit("commit", "--amend", "-m", `"${message.replace(/"/g, '\\"')}"`);
  return runGit("rev-parse", "HEAD");
}
