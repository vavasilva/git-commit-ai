# Git Commit AI - Project Instructions

## Overview
CLI tool that generates Conventional Commit messages from staged git changes using LLMs.

## Tech Stack
- **Language:** TypeScript (ES Modules)
- **Build:** tsup
- **Test:** vitest
- **Dependencies:** chalk, commander, ora, smol-toml

## Commands
```bash
npm run build      # Build to dist/
npm run dev        # Build with watch mode
npm run test       # Run tests
npm run typecheck  # TypeScript check
npm run clean      # Remove dist/
```

## Project Structure
```
src/
├── index.ts       # CLI entry point
├── cli.ts         # Commander setup & interactive flow
├── git.ts         # Git operations (diff, commit, log)
├── config.ts      # TOML config handling
├── prompts.ts     # LLM prompt templates
├── hook.ts        # Git hook management
└── backends/      # LLM backend implementations
    ├── index.ts
    ├── ollama.ts
    ├── llamacpp.ts
    ├── openai.ts
    ├── anthropic.ts
    └── groq.ts
```

## Demo GIF
To regenerate the demo GIF (requires [VHS](https://github.com/charmbracelet/vhs)):
```bash
# 1. Stage some changes
echo "// test" >> src/index.ts
git add src/index.ts

# 2. Run VHS
vhs demo.tape

# 3. Clean up test changes
git reset HEAD
git checkout src/index.ts
```

Note: `demo.tape` is in .gitignore (only `demo.gif` is committed).

## Config Files
- Global: `~/.config/git-commit-ai/config.toml`
- Local: `.gitcommitai` or `.gitcommitai.toml` in project root
