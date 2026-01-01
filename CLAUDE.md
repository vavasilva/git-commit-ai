# git-commit-ai

## Project Location
`~/Code/git-commit-ai`

## Overview
Python CLI tool that generates commit messages using Ollama (local LLM). Transformation of the shell script `~/Code/scripts/git-auto-commit-ollama.sh` into a proper Python app.

## Key Features
- Ollama backend (llama3.1:8b)
- Karma commit convention
- Interactive confirmation before commit (C/E/R/A)
- Individual file commits mode
- Config file support (`~/.config/git-commit-ai/config.toml`)

## Tech Stack
- Python 3.11+
- typer (CLI framework)
- httpx (HTTP client)
- Built-in tomllib for config

## Project Structure
```
src/git_commit_ai/
├── cli.py          # Typer CLI commands
├── config.py       # Config management
├── git.py          # Git operations
├── backends/
│   ├── base.py     # Abstract backend
│   └── ollama.py   # Ollama implementation
└── prompts.py      # Commit message prompts
```

## CLI Commands
```bash
git-commit-ai              # Generate, confirm, commit
git-commit-ai --push       # Commit and push
git-commit-ai -y           # Skip confirmation
git-commit-ai --individual # Per-file commits
git-commit-ai config       # Show/edit config
```

## Confirmation Flow
```
📝 Generated commit message:

  feat(auth): add login validation

[C]onfirm  [E]dit  [R]egenerate  [A]bort? _
```

## Original Script
Reference: `~/Code/scripts/git-auto-commit-ollama.sh`

## Plan File
Full implementation plan at: `~/.claude/plans/prancy-napping-tarjan.md`
