# Task

Port `~/Code/scripts/git-auto-commit-ollama.sh` to a Python CLI application.

## Tech Stack
- Python 3.11+
- typer (CLI framework)
- httpx (async HTTP client)
- tomllib (config parsing)

## Structure
```
src/git_commit_ai/
├── __init__.py
├── cli.py          # Typer commands
├── config.py       # Config management (~/.config/git-commit-ai/config.toml)
├── git.py          # Git operations (diff, add, commit, push)
├── backends/
│   ├── __init__.py
│   ├── base.py     # Abstract backend
│   └── ollama.py   # Ollama API integration
└── prompts.py      # Karma convention prompts
```

## Requirements
- Karma commit convention (feat/fix/docs/style/refactor/test/build)
- Interactive confirmation: [C]onfirm [E]dit [R]egenerate [A]bort
- Flags: --push, -y (skip confirm), --individual (per-file commits)
- Commit after completing each module
- Track progress in `.agent/tasks.md`

## Reference
Study the shell script behavior carefully before implementing each feature.
