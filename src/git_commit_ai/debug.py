"""Debug logging utilities for git-commit-ai."""

from pathlib import Path
from datetime import datetime
from rich.console import Console

# Global debug state
_debug_enabled = False
_console = Console(stderr=True)


def enable_debug():
    """Enable debug mode."""
    global _debug_enabled
    _debug_enabled = True


def is_debug_enabled() -> bool:
    """Check if debug mode is enabled."""
    return _debug_enabled


def debug(message: str, data: str | None = None):
    """Print debug message if debug mode is enabled.

    Args:
        message: The debug message to print.
        data: Optional data to display (will be truncated if long).
    """
    if not _debug_enabled:
        return

    timestamp = datetime.now().strftime("%H:%M:%S")
    _console.print(f"[dim][{timestamp}][/] [cyan][DEBUG][/] {message}")

    if data:
        # Truncate long data
        if len(data) > 500:
            data = data[:500] + f"\n... ({len(data)} chars total, truncated)"
        _console.print(f"[dim]{data}[/]")


def debug_config(cfg):
    """Log configuration details."""
    debug("Config loaded:", f"""
  Model: {cfg.model}
  Ollama URL: {cfg.ollama_url}
  Temperature: {cfg.temperature}
  Retry temps: {cfg.retry_temperatures}""")


def debug_diff(diff: str, files: list[str]):
    """Log diff information."""
    debug(f"Diff size: {len(diff)} chars, Files: {len(files)}",
          f"Files: {', '.join(files[:5])}" + (" ..." if len(files) > 5 else ""))


def debug_prompt(prompt: str):
    """Log the prompt being sent to LLM."""
    debug("Prompt to LLM:", prompt[:500] + "..." if len(prompt) > 500 else prompt)


def debug_response(response: str):
    """Log raw response from LLM."""
    debug("Raw LLM response:", response)


def debug_validation(message: str, is_valid: bool, fixed: str | None = None):
    """Log validation result."""
    status = "[green]valid[/]" if is_valid else "[red]invalid[/]"
    debug(f"Message validation: {status}", message)
    if fixed and fixed != message:
        debug("Fixed message:", fixed)
