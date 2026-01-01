"""Git hook management for git-commit-ai."""

import subprocess
import stat
from pathlib import Path

# The prepare-commit-msg hook script
HOOK_SCRIPT = '''#!/bin/sh
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
'''

HOOK_NAME = "prepare-commit-msg"


def get_git_dir() -> Path | None:
    """Get the .git directory of the current repository.

    Returns:
        Path to .git directory, or None if not in a git repo.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return Path(result.stdout.strip()).resolve()
    except Exception:
        pass
    return None


def get_hook_path() -> Path | None:
    """Get the path to the prepare-commit-msg hook.

    Returns:
        Path to the hook file, or None if not in a git repo.
    """
    git_dir = get_git_dir()
    if git_dir is None:
        return None
    return git_dir / "hooks" / HOOK_NAME


def is_hook_installed() -> bool:
    """Check if the git-commit-ai hook is installed.

    Returns:
        True if our hook is installed, False otherwise.
    """
    hook_path = get_hook_path()
    if hook_path is None or not hook_path.exists():
        return False

    # Check if it's our hook
    content = hook_path.read_text()
    return "git-commit-ai" in content


def install_hook() -> tuple[bool, str]:
    """Install the prepare-commit-msg hook.

    Returns:
        Tuple of (success, message).
    """
    hook_path = get_hook_path()
    if hook_path is None:
        return False, "Not in a git repository"

    # Check if hook already exists
    if hook_path.exists():
        content = hook_path.read_text()
        if "git-commit-ai" in content:
            return True, "Hook already installed"
        else:
            # Backup existing hook
            backup_path = hook_path.with_suffix(".backup")
            hook_path.rename(backup_path)
            return_msg = f"Existing hook backed up to {backup_path.name}"
    else:
        return_msg = "Hook installed successfully"

    # Create hooks directory if needed
    hook_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the hook script
    hook_path.write_text(HOOK_SCRIPT)

    # Make it executable
    hook_path.chmod(hook_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    return True, return_msg


def remove_hook() -> tuple[bool, str]:
    """Remove the prepare-commit-msg hook.

    Returns:
        Tuple of (success, message).
    """
    hook_path = get_hook_path()
    if hook_path is None:
        return False, "Not in a git repository"

    if not hook_path.exists():
        return True, "No hook installed"

    # Check if it's our hook
    content = hook_path.read_text()
    if "git-commit-ai" not in content:
        return False, "Hook exists but was not installed by git-commit-ai"

    # Remove the hook
    hook_path.unlink()

    # Restore backup if exists
    backup_path = hook_path.with_suffix(".backup")
    if backup_path.exists():
        backup_path.rename(hook_path)
        return True, "Hook removed, previous hook restored"

    return True, "Hook removed successfully"
