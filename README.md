# git-commit-ai

Generate commit messages using local LLMs (Ollama).

A CLI tool that analyzes your staged changes and generates [Karma-style](https://karma-runner.github.io/6.4/dev/git-commit-msg.html) commit messages using a local LLM.

## Features

- **Local LLM** - Uses Ollama (llama3.1:8b by default), no API keys needed
- **Karma Convention** - Generates `type(scope): subject` format commits
- **Interactive Flow** - Confirm, Edit, Regenerate, or Abort before committing
- **Individual Commits** - Option to commit each file separately
- **Configurable** - Customize model, temperature, and more via config file

## Installation

```bash
# Requires Python 3.11+
pip install git-commit-ai

# Make sure Ollama is running
brew install ollama
brew services start ollama
ollama pull llama3.1:8b
```

## Quick Start

```bash
# 1. Make changes to your code
echo "print('hello')" > hello.py

# 2. Stage your changes
git add hello.py

# 3. Generate commit message and commit
git-commit-ai

# Output:
# 📝 Generated commit message
#   feat: add hello.py script
# [C]onfirm  [E]dit  [R]egenerate  [A]bort? c
# ✓ Committed: feat: add hello.py script
```

## Usage

```bash
# Basic: stage + generate + confirm + commit
git add .
git-commit-ai

# Auto-commit without confirmation
git add .
git-commit-ai -y

# Commit and push in one command
git add .
git-commit-ai --push

# Commit each modified file separately
git-commit-ai --individual

# Show current config
git-commit-ai config

# Create/edit config file
git-commit-ai config --edit
```

## Interactive Flow

```
📝 Generated commit message

  feat(auth): add login validation

[C]onfirm  [E]dit  [R]egenerate  [A]bort? _
```

## Configuration

Config file location: `~/.config/git-commit-ai/config.toml`

```toml
model = "llama3.1:8b"
ollama_url = "http://localhost:11434"
temperature = 0.7
retry_temperatures = [0.5, 0.3, 0.2]
```

## Commit Types (Karma Convention)

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `build` | Build system or dependencies |
| `chore` | Maintenance tasks |

## License

MIT
