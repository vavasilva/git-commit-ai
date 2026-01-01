"""Git operations for git-commit-ai."""

import subprocess
from dataclasses import dataclass


@dataclass
class DiffResult:
    """Result of a git diff operation."""

    diff: str
    stats: str
    files: list[str]

    @property
    def is_empty(self) -> bool:
        """Check if the diff is empty."""
        return not self.diff.strip()


class GitError(Exception):
    """Exception raised for git operation errors."""

    pass


def run_git(*args: str, check: bool = True) -> str:
    """Run a git command and return the output.

    Args:
        *args: Git command arguments.
        check: Whether to raise an exception on non-zero exit code.

    Returns:
        The command output as a string.

    Raises:
        GitError: If the command fails and check is True.
    """
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            check=check,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        raise GitError(f"Git command failed: {e.stderr.strip()}") from e


def get_staged_diff() -> DiffResult:
    """Get the diff of staged changes.

    Returns:
        DiffResult containing the diff, stats, and file list.
    """
    diff = run_git("diff", "--cached")
    stats = run_git("diff", "--cached", "--stat")
    files_output = run_git("diff", "--cached", "--name-only")
    files = [f for f in files_output.split("\n") if f]

    return DiffResult(diff=diff, stats=stats, files=files)


def get_file_diff(file_path: str) -> DiffResult:
    """Get the diff of a specific staged file.

    Args:
        file_path: Path to the file.

    Returns:
        DiffResult for the specific file.
    """
    diff = run_git("diff", "--cached", "--", file_path)
    stats = run_git("diff", "--cached", "--stat", "--", file_path)
    files = [file_path] if diff else []

    return DiffResult(diff=diff, stats=stats, files=files)


def add_files(*paths: str) -> None:
    """Stage files for commit.

    Args:
        *paths: File paths to stage. Use "." for all files.
    """
    if not paths:
        paths = (".",)
    run_git("add", *paths)


def commit(message: str) -> str:
    """Create a commit with the given message.

    Args:
        message: The commit message.

    Returns:
        The commit hash.
    """
    run_git("commit", "-m", message)
    return run_git("rev-parse", "HEAD")


def push() -> None:
    """Push commits to the remote repository."""
    branch = get_current_branch()
    run_git("push", "origin", branch)


def get_current_branch() -> str:
    """Get the name of the current branch.

    Returns:
        The current branch name.
    """
    return run_git("rev-parse", "--abbrev-ref", "HEAD")


def get_modified_files() -> list[str]:
    """Get list of all modified files (staged, unstaged, and untracked).

    Returns:
        List of file paths.
    """
    files = set()

    # Modified and staged files
    staged = run_git("diff", "--cached", "--name-only", check=False)
    if staged:
        files.update(staged.split("\n"))

    # Modified but not staged
    modified = run_git("diff", "--name-only", check=False)
    if modified:
        files.update(modified.split("\n"))

    # Untracked files
    untracked = run_git("ls-files", "--others", "--exclude-standard", check=False)
    if untracked:
        files.update(untracked.split("\n"))

    return [f for f in files if f]


def has_staged_changes() -> bool:
    """Check if there are any staged changes.

    Returns:
        True if there are staged changes, False otherwise.
    """
    diff = run_git("diff", "--cached", "--name-only", check=False)
    return bool(diff.strip())
