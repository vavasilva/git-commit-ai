import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HookResult } from "./types.js";

const HOOK_SCRIPT = `#!/bin/sh
# git-commit-ai prepare-commit-msg hook
# This hook generates commit messages using AI

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Only run for regular commits (not merge, squash, etc.)
if [ -n "$COMMIT_SOURCE" ]; then
    exit 0
fi

# Check if there's already a message (e.g., from -m flag)
if [ -s "$COMMIT_MSG_FILE" ]; then
    # File is not empty, check if it's just the default template
    FIRST_LINE=$(head -n 1 "$COMMIT_MSG_FILE")
    if [ -n "$FIRST_LINE" ] && ! echo "$FIRST_LINE" | grep -q "^#"; then
        # There's actual content, don't override
        exit 0
    fi
fi

# Generate commit message using git-commit-ai
MESSAGE=$(git-commit-ai --hook-mode 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$MESSAGE" ]; then
    # Write the generated message, preserving any existing comments
    COMMENTS=$(grep "^#" "$COMMIT_MSG_FILE" 2>/dev/null || true)
    echo "$MESSAGE" > "$COMMIT_MSG_FILE"
    if [ -n "$COMMENTS" ]; then
        echo "" >> "$COMMIT_MSG_FILE"
        echo "$COMMENTS" >> "$COMMIT_MSG_FILE"
    fi
fi

exit 0
`;

const HOOK_NAME = "prepare-commit-msg";

function getGitDir(): string | null {
  try {
    const result = execSync("git rev-parse --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return null;
  }
}

function getHookPath(): string | null {
  const gitDir = getGitDir();
  if (!gitDir) return null;
  return join(gitDir, "hooks", HOOK_NAME);
}

export function isHookInstalled(): boolean {
  const hookPath = getHookPath();
  if (!hookPath || !existsSync(hookPath)) {
    return false;
  }

  const content = readFileSync(hookPath, "utf-8");
  return content.includes("git-commit-ai");
}

export function installHook(): HookResult {
  const hookPath = getHookPath();
  if (!hookPath) {
    return { success: false, message: "Not in a git repository" };
  }

  let returnMsg = "Hook installed successfully";

  // Check if hook already exists
  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, "utf-8");
    if (content.includes("git-commit-ai")) {
      return { success: true, message: "Hook already installed" };
    }
    // Backup existing hook
    const backupPath = hookPath + ".backup";
    writeFileSync(backupPath, content, "utf-8");
    returnMsg = `Existing hook backed up to ${HOOK_NAME}.backup`;
  }

  // Create hooks directory if needed
  const hooksDir = dirname(hookPath);
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write the hook script
  writeFileSync(hookPath, HOOK_SCRIPT, "utf-8");

  // Make it executable
  chmodSync(hookPath, 0o755);

  return { success: true, message: returnMsg };
}

export function removeHook(): HookResult {
  const hookPath = getHookPath();
  if (!hookPath) {
    return { success: false, message: "Not in a git repository" };
  }

  if (!existsSync(hookPath)) {
    return { success: true, message: "No hook installed" };
  }

  // Check if it's our hook
  const content = readFileSync(hookPath, "utf-8");
  if (!content.includes("git-commit-ai")) {
    return { success: false, message: "Hook exists but was not installed by git-commit-ai" };
  }

  // Remove the hook
  unlinkSync(hookPath);

  // Restore backup if exists
  const backupPath = hookPath + ".backup";
  if (existsSync(backupPath)) {
    const backupContent = readFileSync(backupPath, "utf-8");
    writeFileSync(hookPath, backupContent, "utf-8");
    unlinkSync(backupPath);
    return { success: true, message: "Hook removed, previous hook restored" };
  }

  return { success: true, message: "Hook removed successfully" };
}
