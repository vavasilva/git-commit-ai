"""Prompt templates for commit message generation."""

import re

KARMA_PROMPT = """Create a git commit message following Karma convention.

FORMAT: <type>(<scope>): <subject>

TYPES (lowercase):
- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting, no code change
- refactor: code restructuring
- test: adding tests
- build: build system or dependencies

RULES:
- Scope is optional (module or component affected)
- Subject: imperative mood, lowercase, no period, max 72 chars
- Example: feat(auth): add login validation

Context:
{context}

Diff:
{diff}

Reply with ONLY the commit message, nothing else."""

# Pattern to validate Karma convention commit messages
KARMA_PATTERN = re.compile(
    r"^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)"
    r"(\([^)]+\))?"
    r":\s*.+"
)

# Mapping of common words to commit types for fallback
ACTION_TO_TYPE = {
    "add": "feat",
    "added": "feat",
    "adding": "feat",
    "create": "feat",
    "implement": "feat",
    "fix": "fix",
    "fixed": "fix",
    "fixing": "fix",
    "repair": "fix",
    "update": "refactor",
    "updated": "refactor",
    "updating": "refactor",
    "improve": "refactor",
    "remove": "refactor",
    "removed": "refactor",
    "removing": "refactor",
    "delete": "refactor",
    "document": "docs",
    "documented": "docs",
    "test": "test",
    "tested": "test",
    "testing": "test",
}


def build_prompt(diff: str, context: str) -> str:
    """Build a prompt for commit message generation.

    Args:
        diff: The git diff content.
        context: Additional context (file list, stats).

    Returns:
        The formatted prompt string.
    """
    return KARMA_PROMPT.format(diff=diff, context=context)


def validate_message(message: str) -> bool:
    """Check if a message follows Karma convention.

    Args:
        message: The commit message to validate.

    Returns:
        True if the message is valid, False otherwise.
    """
    return bool(KARMA_PATTERN.match(message.strip()))


def clean_message(message: str) -> str:
    """Clean up a generated commit message.

    Removes common prefixes and trailing punctuation.

    Args:
        message: The raw generated message.

    Returns:
        The cleaned message.
    """
    # Take only the first line
    message = message.strip().split("\n")[0]

    # Remove common prefixes that models sometimes add
    prefixes = [
        "Here is ",
        "I've ",
        "The commit message is:",
        "Commit message:",
        "Here's ",
    ]
    for prefix in prefixes:
        if message.lower().startswith(prefix.lower()):
            message = message[len(prefix) :]

    # Strip whitespace and trailing period
    message = message.strip().rstrip(".")

    return message


def fix_message(message: str) -> str:
    """Attempt to fix a non-conforming message.

    Args:
        message: The message to fix.

    Returns:
        A message that follows Karma convention.
    """
    message = clean_message(message)

    # If already valid, return as-is
    if validate_message(message):
        return message

    # Try to infer type from first word
    words = message.split()
    if words:
        first_word = words[0].lower().rstrip(":")
        commit_type = ACTION_TO_TYPE.get(first_word, "chore")

        # Build the message
        subject = " ".join(words).lower()
        if not subject.endswith(":"):
            return f"{commit_type}: {subject}"

    return f"chore: {message.lower()}"
