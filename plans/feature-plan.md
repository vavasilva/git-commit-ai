# Plan: git-commit-ai Feature Enhancements

**Source:** `.serena/memories/future-features.md`
**Template:** feature
**Status:** ✅ COMPLETE

---

## Phase 1: High Priority Features 🎯

### 1.1 Implement `--amend` flag
**Tasks:**
- [x] Add `getLastCommitDiff()` function in `git.ts` to retrieve the diff of the last commit
- [x] Add `--amend` flag definition in `cli.ts`
- [x] Implement logic to regenerate commit message using the last commit's diff
- [x] Execute `git commit --amend -m "new message"` with the regenerated message
- [x] Add unit tests for `--amend` functionality
- [x] Update `--help` output to document `--amend` flag

**Completion Criteria:** ✅
- `git-commit-ai --amend` regenerates the last commit message using the LLM
- Tests pass for the new functionality

---

### 1.2 Implement `--scope <scope>` flag
**Tasks:**
- [x] Add `--scope <scope>` flag definition in `cli.ts`
- [x] Modify prompt generation to include scope constraint OR post-process message to inject scope
- [x] Add validation for scope format (alphanumeric, lowercase)
- [x] Add unit tests for `--scope` functionality
- [x] Update `--help` output to document `--scope` flag

**Completion Criteria:** ✅
- `git-commit-ai --scope auth` produces messages like `feat(auth): ...`
- Tests pass for scope injection

---

### 1.3 Implement `--type <type>` flag
**Tasks:**
- [x] Add `--type <type>` flag definition in `cli.ts`
- [x] Modify prompt generation to include type constraint OR post-process message to use specified type
- [x] Add validation for valid conventional commit types (feat, fix, docs, style, refactor, test, chore, etc.)
- [x] Add unit tests for `--type` functionality
- [x] Update `--help` output to document `--type` flag

**Completion Criteria:** ✅
- `git-commit-ai --type fix` produces messages starting with `fix: ...`
- Tests pass for type enforcement

---

## Phase 2: Medium Priority Features 🔧

### 2.1 Implement `--context "..."` flag
**Tasks:**
- [x] Add `--context <text>` flag definition in `cli.ts`
- [x] Pass context to LLM prompt as additional information
- [x] Add unit tests for `--context` functionality
- [x] Update `--help` output to document `--context` flag

**Completion Criteria:** ✅
- Context is included in LLM prompt and influences generated message
- Tests pass

---

### 2.2 Implement `.gitcommitai` local config
**Tasks:**
- [x] Modify config loading to check for `.gitcommitai` in repo root
- [x] Implement config merging (local overrides global)
- [x] Add documentation for local config file format
- [x] Add unit tests for config precedence

**Completion Criteria:** ✅
- Local `.gitcommitai` config overrides global settings
- Tests pass for config merging

---

### 2.3 Implement `ignore_patterns` config option
**Tasks:**
- [x] Add `ignore_patterns` field to config schema
- [x] Modify diff generation to filter out files matching patterns
- [x] Support glob patterns (e.g., `*.lock`, `dist/*`)
- [x] Add unit tests for pattern matching
- [x] Document the config option

**Completion Criteria:** ✅
- Files matching patterns are excluded from diff sent to LLM
- Tests pass

---

## Phase 3: Nice to Have Features ✨

### 3.1 Implement `--lang pt|en|es` flag
**Tasks:**
- [x] Add `--lang <code>` flag definition in `cli.ts`
- [x] Modify prompt to request messages in specified language
- [x] Add unit tests for language flag

**Completion Criteria:** ✅
- Messages generated in specified language
- Tests pass

---

### 3.2 Implement `--issue <number>` flag
**Tasks:**
- [x] Add `--issue <number>` flag definition in `cli.ts`
- [x] Include issue reference in generated commit message
- [x] Add unit tests for issue integration

**Completion Criteria:** ✅
- `git-commit-ai --issue 123` produces messages referencing the issue
- Tests pass

---

### 3.3 Implement `--breaking` flag
**Tasks:**
- [x] Add `--breaking` flag definition in `cli.ts`
- [x] Modify message format to use `!` notation (e.g., `feat!:`)
- [x] Add unit tests for breaking change flag

**Completion Criteria:** ✅
- `git-commit-ai --breaking` produces messages with `!` marker
- Tests pass

---

### 3.4 Implement `--co-author` flag
**Tasks:**
- [x] Add `--co-author <name>` flag definition in `cli.ts`
- [x] Append `Co-authored-by:` trailer to commit message
- [x] Support multiple co-authors
- [x] Add unit tests for co-author functionality

**Completion Criteria:** ✅
- Commit messages include co-author trailer
- Tests pass

---

## Summary

**Total Tasks:** 42
**Status:** ✅ ALL COMPLETE

🏷️ **Promise Tags:**
- Phase 1: ✅ `--amend` works, `--scope` works, `--type` works, all tests pass, `--help` updated
- Phase 2: ✅ `--context` works, local config works, `ignore_patterns` works, tests pass
- Phase 3: ✅ `--lang` works, `--issue` works, `--breaking` works, `--co-author` works, tests pass
