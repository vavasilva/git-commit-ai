"""Prompt templates for commit message generation."""

import re

SUMMARIZE_PROMPT = """Summarize the following code changes in plain English.

Provide a brief, clear summary that explains:
1. What files were changed
2. What was added, removed, or modified
3. The likely purpose of these changes

Keep it concise (3-5 bullet points). Focus on the "what" and "why".

{context}

DIFF:
```
{diff}
```

Provide only the summary, no additional commentary."""


KARMA_PROMPT = """Analyze the git diff below and create a commit message following Karma convention.

FORMAT: <type>(<scope>): <subject>

TYPES (use the most appropriate):
- feat: new feature or capability
- fix: bug fix
- docs: documentation changes (README, comments, docstrings)
- style: formatting only (whitespace, semicolons)
- refactor: code change that neither fixes bug nor adds feature
- test: adding or modifying tests
- build: build system, dependencies, package config
- chore: maintenance tasks

RULES:
- Scope is optional - use the main file/module name if relevant
- Subject must describe WHAT changed in the diff, not a generic message
- Use imperative mood: "add" not "added", "fix" not "fixed"
- Lowercase, no period at end, max 72 chars

EXAMPLES based on diff content:
- Adding README.md → docs: add README with usage instructions
- Fixing null check in auth.py → fix(auth): handle null user in login
- New API endpoint → feat(api): add user profile endpoint
- Updating dependencies → build: update httpx to 0.25.0

IMPORTANT: Base your message ONLY on the actual changes shown in the diff below.
Do NOT use the examples above if they don't match the diff content.

{context}

DIFF TO ANALYZE:
```
{diff}
```

Reply with ONLY the commit message, nothing else. No quotes, no explanation."""

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


MAX_DIFF_CHARS = 8000  # Truncate large diffs to avoid timeout


def truncate_diff(diff: str, max_chars: int = MAX_DIFF_CHARS) -> str:
    """Truncate a diff to avoid overwhelming the LLM.

    Args:
        diff: The git diff content.
        max_chars: Maximum characters to keep.

    Returns:
        The truncated diff with a note if truncated.
    """
    if len(diff) <= max_chars:
        return diff

    truncated = diff[:max_chars]
    # Try to cut at a line boundary
    last_newline = truncated.rfind("\n")
    if last_newline > max_chars * 0.8:
        truncated = truncated[:last_newline]

    return truncated + "\n\n[... diff truncated for brevity ...]"


def build_prompt(diff: str, context: str) -> str:
    """Build a prompt for commit message generation.

    Args:
        diff: The git diff content.
        context: Additional context (file list, stats).

    Returns:
        The formatted prompt string.
    """
    truncated_diff = truncate_diff(diff)
    return KARMA_PROMPT.format(diff=truncated_diff, context=context)


def build_summarize_prompt(diff: str, context: str) -> str:
    """Build a prompt for summarizing changes.

    Args:
        diff: The git diff content.
        context: Additional context (file list, stats).

    Returns:
        The formatted prompt string.
    """
    truncated_diff = truncate_diff(diff)
    return SUMMARIZE_PROMPT.format(diff=truncated_diff, context=context)


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
