# git-commit-ai

Generate commit messages using LLMs (Ollama, OpenAI, Anthropic, Groq).

A CLI tool that analyzes your staged changes and generates [Karma-style](https://karma-runner.github.io/6.4/dev/git-commit-msg.html) commit messages using AI.

## Features

- **Multiple Backends** - Ollama (local), OpenAI, Anthropic Claude, Groq
- **Auto-Detection** - Automatically selects available backend
- **Karma Convention** - Generates `type(scope): subject` format commits
- **Interactive Flow** - Confirm, Edit, Regenerate, or Abort before committing
- **Individual Commits** - Option to commit each file separately
- **Dry Run** - Preview messages without committing
- **Git Hook** - Auto-generate messages on `git commit`
- **Summarize** - Preview changes in plain English before committing
- **Debug Mode** - Troubleshoot LLM responses
- **Configurable** - Customize model, temperature, and more via config file

## Installation

```bash
# Requires Node.js 20+
npm install -g @vavasilva/git-commit-ai
```

### Backend Setup

Choose at least one backend:

**Ollama (Local, Free)**
```bash
brew install ollama
brew services start ollama
ollama pull llama3.1:8b
```

**OpenAI**
```bash
export OPENAI_API_KEY="your-api-key"
```

**Anthropic (Claude)**
```bash
export ANTHROPIC_API_KEY="your-api-key"
```

**Groq (Fast & Free tier)**
```bash
export GROQ_API_KEY="your-api-key"
```

## Quick Start

```bash
# 1. Make changes to your code
echo "console.log('hello')" > hello.js

# 2. Stage your changes
git add hello.js

# 3. Generate commit message and commit
git-commit-ai

# Output:
# 📝 Generated commit message
#   feat: add hello.js script
# [C]onfirm  [E]dit  [R]egenerate  [A]bort? c
# ✓ Committed: feat: add hello.js script
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

# Preview message without committing (dry run)
git add .
git-commit-ai --dry-run

# Use a specific backend
git-commit-ai --backend openai
git-commit-ai --backend anthropic
git-commit-ai --backend groq

# Override model
git-commit-ai --model gpt-4o
git-commit-ai --model claude-3-sonnet-20240229

# Adjust creativity (temperature)
git-commit-ai --temperature 0.3

# Preview changes before committing
git add .
git-commit-ai summarize

# Enable debug output for troubleshooting
git-commit-ai --debug

# Show current config
git-commit-ai config

# Create/edit config file
git-commit-ai config --edit
```

## Git Hook (Auto-generate on commit)

Install a git hook to automatically generate commit messages:

```bash
# Install the hook
git-commit-ai hook --install

# Now just use git commit normally!
git add .
git commit
# Message is auto-generated and opens in your editor

# Check hook status
git-commit-ai hook --status

# Remove the hook
git-commit-ai hook --remove
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
# Backend: ollama, openai, anthropic, groq
backend = "ollama"
model = "llama3.1:8b"
ollama_url = "http://localhost:11434"
temperature = 0.7
retry_temperatures = [0.5, 0.3, 0.2]
```

### Default Models by Backend

| Backend | Default Model |
|---------|---------------|
| ollama | llama3.1:8b |
| openai | gpt-4o-mini |
| anthropic | claude-3-haiku-20240307 |
| groq | llama-3.1-8b-instant |

## CLI Options

| Option | Description |
|--------|-------------|
| `-p, --push` | Push after commit |
| `-y, --yes` | Skip confirmation |
| `-i, --individual` | Commit files individually |
| `-d, --debug` | Enable debug output |
| `--dry-run` | Show message without committing |
| `-b, --backend <name>` | Backend to use |
| `-m, --model <name>` | Override model |
| `-t, --temperature <n>` | Override temperature (0.0-1.0) |

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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GROQ_API_KEY` | Groq API key |

## License

MIT
