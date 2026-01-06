# git-commit-ai

> AI-powered commit message generator for Git. Automate your git workflow with intelligent, conventional commit messages.

A command-line tool that uses Large Language Models (LLMs) to analyze your staged changes and automatically generate [Karma-style](https://karma-runner.github.io/6.4/dev/git-commit-msg.html) / [Conventional Commits](https://www.conventionalcommits.org/) messages.

**Supported AI backends:** Ollama, llama.cpp, OpenAI (GPT-4), Anthropic (Claude), Groq (LLaMA)

## Features

- **Multiple Backends** - Ollama (local), llama.cpp (local), OpenAI, Anthropic Claude, Groq
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
# macOS
brew install ollama
brew services start ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl start ollama

# Windows - download installer from:
# https://ollama.com/download/windows

# Pull a model (all platforms)
ollama pull llama3.1:8b
```

**llama.cpp (Local, Free, Low Memory)**

Run local GGUF models with `llama-server` (auto-detected on port 8080):

```bash
# Install llama.cpp
# macOS
brew install llama.cpp

# Linux (Ubuntu/Debian) - build from source
sudo apt install build-essential cmake
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build && cmake --build build --config Release
sudo cp build/bin/llama-server /usr/local/bin/

# Windows - download pre-built binaries from:
# https://github.com/ggml-org/llama.cpp/releases

# Start the server (downloads model automatically from Hugging Face)
llama-server -hf Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF -ngl 99 --port 8080

# Use with git-commit-ai (auto-detected if running on port 8080)
git-commit-ai

# Or explicitly use llamacpp backend
git-commit-ai --backend llamacpp

# Configure as default backend
git-commit-ai config --set backend=llamacpp
```

**Run llama-server as a service**

<details>
<summary><strong>macOS (launchd)</strong></summary>

```bash
# Create launchd service
cat > ~/Library/LaunchAgents/com.llamacpp.server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.llamacpp.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/llama-server</string>
        <string>-hf</string>
        <string>Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF</string>
        <string>-ngl</string>
        <string>99</string>
        <string>--port</string>
        <string>8080</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/llama-server.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/llama-server.err</string>
</dict>
</plist>
EOF

# Start the service
launchctl load ~/Library/LaunchAgents/com.llamacpp.server.plist

# Stop the service
launchctl unload ~/Library/LaunchAgents/com.llamacpp.server.plist

# Check logs
tail -f /tmp/llama-server.log
```

</details>

<details>
<summary><strong>Linux (systemd)</strong></summary>

```bash
# Create systemd service
sudo cat > /etc/systemd/system/llama-server.service << 'EOF'
[Unit]
Description=llama.cpp Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/llama-server -hf Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF -ngl 99 --port 8080
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/llama-server.log
StandardError=append:/var/log/llama-server.err

[Install]
WantedBy=multi-user.target
EOF

# Replace $USER with your username
sudo sed -i "s/\$USER/$USER/" /etc/systemd/system/llama-server.service

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable llama-server
sudo systemctl start llama-server

# Check status
sudo systemctl status llama-server

# View logs
journalctl -u llama-server -f
```

</details>

<details>
<summary><strong>Windows (Task Scheduler)</strong></summary>

**Option 1: PowerShell script with Task Scheduler**

1. Create a startup script `C:\llama-server\start-llama.ps1`:
```powershell
# start-llama.ps1
Start-Process -FilePath "C:\llama-server\llama-server.exe" `
    -ArgumentList "-hf", "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF", "-ngl", "99", "--port", "8080" `
    -WindowStyle Hidden `
    -RedirectStandardOutput "C:\llama-server\llama-server.log" `
    -RedirectStandardError "C:\llama-server\llama-server.err"
```

2. Create a scheduled task (run in PowerShell as Administrator):
```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\llama-server\start-llama.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType S4U
Register-ScheduledTask -TaskName "LlamaServer" -Action $action -Trigger $trigger -Principal $principal

# Start immediately
Start-ScheduledTask -TaskName "LlamaServer"

# Stop the service
Stop-ScheduledTask -TaskName "LlamaServer"

# Remove the service
Unregister-ScheduledTask -TaskName "LlamaServer" -Confirm:$false
```

**Option 2: Using NSSM (Non-Sucking Service Manager)**

```powershell
# Install NSSM (using chocolatey)
choco install nssm

# Install llama-server as a Windows service
nssm install LlamaServer "C:\llama-server\llama-server.exe" "-hf Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF -ngl 99 --port 8080"
nssm set LlamaServer AppDirectory "C:\llama-server"
nssm set LlamaServer AppStdout "C:\llama-server\llama-server.log"
nssm set LlamaServer AppStderr "C:\llama-server\llama-server.err"

# Start the service
nssm start LlamaServer

# Stop the service
nssm stop LlamaServer

# Remove the service
nssm remove LlamaServer confirm
```

</details>

**OpenAI**
```bash
export OPENAI_API_KEY="your-api-key"
```

**OpenAI-Compatible APIs**

Any OpenAI-compatible API can be used by setting `OPENAI_BASE_URL`:
```bash
# Local server (llama.cpp, vLLM, etc.)
export OPENAI_BASE_URL="http://localhost:8080/v1"

# Or other providers (Together AI, Anyscale, etc.)
export OPENAI_BASE_URL="https://api.together.xyz/v1"
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

# Amend the last commit with a new message
git-commit-ai --amend

# Force a specific scope and type
git-commit-ai --scope auth --type fix

# Generate message in a specific language
git-commit-ai --lang pt

# Reference an issue
git-commit-ai --issue 123

# Mark as breaking change
git-commit-ai --breaking

# Add co-authors
git-commit-ai --co-author "Jane Doe <jane@example.com>"

# Provide additional context
git-commit-ai --context "This fixes the login bug reported by QA"

# Use a specific backend
git-commit-ai --backend llamacpp
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

# Set a config value
git-commit-ai config --set backend=llamacpp
git-commit-ai config --set model=gpt-4o
git-commit-ai config --set temperature=0.5

# Use short aliases
git-commit-ai config --set lang=pt        # → default_language
git-commit-ai config --set scope=api      # → default_scope
git-commit-ai config --set type=feat      # → default_type
git-commit-ai config --set temp=0.5       # → temperature

# List valid config keys and aliases
git-commit-ai config --list-keys

# Create/edit config file manually
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

### Global Config

Location: `~/.config/git-commit-ai/config.toml`

```toml
# Backend: ollama, llamacpp, openai, anthropic, groq
backend = "ollama"
model = "llama3.1:8b"
ollama_url = "http://localhost:11434"
temperature = 0.7
retry_temperatures = [0.5, 0.3, 0.2]

# OpenAI Base URL - change this to use OpenAI-compatible APIs
# Examples:
#   - Default OpenAI: https://api.openai.com/v1
#   - llama.cpp:      http://localhost:8080/v1
#   - Together AI:    https://api.together.xyz/v1
openai_base_url = "https://api.openai.com/v1"

# Optional: Ignore files from diff analysis
ignore_patterns = ["*.lock", "package-lock.json", "*.min.js"]

# Optional: Set defaults for commit messages
default_scope = "api"          # Default scope if not specified
default_type = "feat"          # Default commit type
default_language = "en"        # Default language (en, pt, es, fr, de)
```

### Local Config (per-project)

Create `.gitcommitai` or `.gitcommitai.toml` in your project root to override global settings:

```toml
# .gitcommitai
default_scope = "frontend"
default_language = "pt"
ignore_patterns = ["dist/*", "*.generated.ts"]
```

### Default Models by Backend

| Backend | Default Model |
|---------|---------------|
| ollama | llama3.1:8b |
| llamacpp | gpt-4o-mini (alias) |
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
| `--amend` | Regenerate and amend the last commit |
| `-b, --backend <name>` | Backend to use |
| `-m, --model <name>` | Override model |
| `-t, --temperature <n>` | Override temperature (0.0-1.0) |
| `-s, --scope <scope>` | Force a specific scope (e.g., auth, api) |
| `--type <type>` | Force commit type (feat, fix, docs, etc.) |
| `-c, --context <text>` | Provide additional context for generation |
| `-l, --lang <code>` | Language for message (en, pt, es, fr, de) |
| `--issue <ref>` | Reference an issue (e.g., 123 or #123) |
| `--breaking` | Mark as breaking change (adds ! to type) |
| `--co-author <author>` | Add co-author (can be repeated) |

## Config Commands

| Command | Description |
|---------|-------------|
| `config` | Show current configuration |
| `config --edit` | Create/edit config file manually |
| `config --set <key=value>` | Set a config value |
| `config --list-keys` | List all valid config keys |

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
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL (default: `https://api.openai.com/v1`) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GROQ_API_KEY` | Groq API key |

## License

MIT
