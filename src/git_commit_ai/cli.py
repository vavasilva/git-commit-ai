"""CLI interface for git-commit-ai."""

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

from .backends import OllamaBackend
from .config import Config
from .debug import (
    debug,
    debug_config,
    debug_diff,
    debug_prompt,
    debug_response,
    debug_validation,
    enable_debug,
)
from .git import (
    GitError,
    add_files,
    commit,
    get_file_diff,
    get_modified_files,
    get_staged_diff,
    push,
)
from .prompts import (
    build_prompt,
    build_summarize_prompt,
    clean_message,
    fix_message,
    validate_message,
)

app = typer.Typer(
    name="git-commit-ai",
    help="Generate commit messages using local LLMs.",
    no_args_is_help=False,
    invoke_without_command=True,
)

console = Console()


def generate_message(
    backend: OllamaBackend,
    diff_content: str,
    context: str,
    temperatures: list[float],
) -> str | None:
    """Generate a valid commit message with retry logic."""
    prompt = build_prompt(diff_content, context)
    debug_prompt(prompt)

    for temp in temperatures:
        debug(f"Trying temperature: {temp}")
        try:
            raw_message = backend.generate(prompt, temperature=temp)
            debug_response(raw_message)

            message = clean_message(raw_message)
            is_valid = validate_message(message)
            debug_validation(message, is_valid)

            if is_valid:
                return message

            # Try to fix the message
            fixed = fix_message(message)
            if validate_message(fixed):
                debug_validation(fixed, True, fixed)
                return fixed

        except Exception as e:
            debug(f"Generation error: {e}")
            console.print(f"[yellow]Warning: Generation failed at temp {temp}: {e}[/]")
            continue

    return None


def prompt_action(message: str) -> str:
    """Show the commit message and prompt for action."""
    console.print()
    console.print(Panel(message, title="📝 Generated commit message", border_style="green"))
    console.print()

    choice = Prompt.ask(
        "[C]onfirm  [E]dit  [R]egenerate  [A]bort",
        choices=["c", "e", "r", "a"],
        default="c",
        show_choices=False,
    )
    return choice.lower()


def edit_message(message: str) -> str:
    """Allow user to edit the commit message."""
    console.print("\n[dim]Enter new commit message (or press Enter to keep current):[/]")
    new_message = Prompt.ask("Message", default=message)
    return new_message


def run_commit_flow(
    backend: OllamaBackend,
    cfg: Config,
    diff_content: str,
    context: str,
    skip_confirm: bool,
) -> str | None:
    """Run the commit flow with regeneration support."""
    temperatures = [cfg.temperature] + cfg.retry_temperatures

    while True:
        message = generate_message(backend, diff_content, context, temperatures)

        if message is None:
            console.print("[red]Error: Failed to generate a valid commit message.[/]")
            message = "chore: update files"
            console.print(f"[yellow]Using fallback: {message}[/]")

        if skip_confirm:
            return message

        action = prompt_action(message)

        if action == "c":
            return message
        elif action == "e":
            return edit_message(message)
        elif action == "r":
            console.print("[dim]Regenerating...[/]")
            continue
        elif action == "a":
            return None

    return None


def handle_single_commit(backend: OllamaBackend, cfg: Config, skip_confirm: bool) -> None:
    """Handle a single commit for all staged changes."""
    diff_result = get_staged_diff()

    if diff_result.is_empty:
        console.print("[yellow]No changes to commit.[/]")
        raise typer.Exit(0)

    debug_diff(diff_result.diff, diff_result.files)
    context = f"Files changed:\n{chr(10).join(diff_result.files[:5])}\nStats: {diff_result.stats}"

    message = run_commit_flow(backend, cfg, diff_result.diff, context, skip_confirm)

    if message is None:
        console.print("[yellow]Aborted.[/]")
        raise typer.Exit(0)

    try:
        commit(message)
        debug(f"Commit successful: {message}")
        console.print(f"[green]✓ Committed:[/] {message}")
    except GitError as e:
        debug(f"Commit failed: {e}")
        console.print(f"[red]Error: {e}[/]")
        raise typer.Exit(1)


def handle_individual_commits(backend: OllamaBackend, cfg: Config, skip_confirm: bool) -> None:
    """Handle individual commits for each file."""
    files_to_commit = get_modified_files()

    if not files_to_commit:
        console.print("[yellow]No files to commit.[/]")
        raise typer.Exit(0)

    console.print(f"[dim]Found {len(files_to_commit)} files to commit individually.[/]")

    for file_path in files_to_commit:
        add_files(file_path)
        diff_result = get_file_diff(file_path)

        if diff_result.is_empty:
            continue

        console.print(f"\n[bold]Processing:[/] {file_path}")

        context = f"File: {file_path}\nStats: {diff_result.stats}"
        message = run_commit_flow(backend, cfg, diff_result.diff, context, skip_confirm)

        if message is None:
            console.print(f"[yellow]Skipped: {file_path}[/]")
            continue

        try:
            commit(message)
            console.print(f"[green]✓ Committed:[/] {message}")
        except GitError as e:
            console.print(f"[red]Error committing {file_path}: {e}[/]")


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    push_changes: bool = typer.Option(False, "--push", "-p", help="Push after commit"),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation"),
    individual: bool = typer.Option(
        False, "--individual", "-i", help="Commit files individually"
    ),
    debug_mode: bool = typer.Option(
        False, "--debug", "-d", help="Enable debug output for troubleshooting"
    ),
):
    """Generate a commit message and commit staged changes."""
    # Enable debug mode if requested
    if debug_mode:
        enable_debug()
        debug("Debug mode enabled")

    # Skip if a subcommand is invoked
    if ctx.invoked_subcommand is not None:
        return

    cfg = Config.load()
    debug_config(cfg)

    backend = OllamaBackend(model=cfg.model, base_url=cfg.ollama_url)

    # Check if Ollama is available
    if not backend.is_available():
        console.print("[red]Error: Ollama is not running.[/]")
        console.print("[dim]Start it with: brew services start ollama[/]")
        raise typer.Exit(1)

    # Stage all files
    add_files(".")

    if individual:
        handle_individual_commits(backend, cfg, yes)
    else:
        handle_single_commit(backend, cfg, yes)

    if push_changes:
        try:
            push()
            console.print("[green]✓ Changes pushed to remote.[/]")
        except GitError as e:
            console.print(f"[red]Error pushing: {e}[/]")
            raise typer.Exit(1)


@app.command("config")
def config_cmd(
    edit: bool = typer.Option(False, "--edit", "-e", help="Create/edit configuration file"),
):
    """Show or edit configuration."""
    cfg = Config.load()

    if edit:
        console.print("[dim]Creating default config file...[/]")
        cfg.save()
        console.print(f"[green]Config saved to: {cfg.get_config_path()}[/]")
        console.print("[dim]Edit this file to customize settings.[/]")
    else:
        console.print(cfg.show())


@app.command("summarize")
def summarize_cmd(
    show_diff: bool = typer.Option(False, "--diff", help="Also show the raw diff"),
    debug_mode: bool = typer.Option(
        False, "--debug", "-d", help="Enable debug output"
    ),
):
    """Summarize staged changes in plain English."""
    if debug_mode:
        enable_debug()

    cfg = Config.load()
    backend = OllamaBackend(model=cfg.model, base_url=cfg.ollama_url)

    # Check if Ollama is available
    if not backend.is_available():
        console.print("[red]Error: Ollama is not running.[/]")
        console.print("[dim]Start it with: brew services start ollama[/]")
        raise typer.Exit(1)

    # Get staged diff (don't stage new files for summarize)
    diff_result = get_staged_diff()

    if diff_result.is_empty:
        console.print("[yellow]No staged changes to summarize.[/]")
        console.print("[dim]Stage changes with: git add <files>[/]")
        raise typer.Exit(0)

    debug_diff(diff_result.diff, diff_result.files)

    # Show files being summarized
    console.print(f"\n[bold]Files to summarize:[/] {len(diff_result.files)}")
    for f in diff_result.files[:10]:
        console.print(f"  • {f}")
    if len(diff_result.files) > 10:
        console.print(f"  ... and {len(diff_result.files) - 10} more")

    # Build context and prompt
    context = f"Files changed: {', '.join(diff_result.files[:5])}\nStats: {diff_result.stats}"
    prompt = build_summarize_prompt(diff_result.diff, context)
    debug_prompt(prompt)

    console.print("\n[dim]Generating summary...[/]")

    try:
        summary = backend.generate(prompt, temperature=cfg.temperature)
        debug_response(summary)

        console.print()
        console.print(Panel(summary.strip(), title="📋 Summary", border_style="blue"))

        if show_diff:
            console.print()
            console.print(Panel(diff_result.diff, title="📄 Diff", border_style="dim"))

    except Exception as e:
        debug(f"Summary generation error: {e}")
        console.print(f"[red]Error generating summary: {e}[/]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
