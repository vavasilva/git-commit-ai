const SUMMARIZE_PROMPT = `Summarize the following code changes in plain English.

Provide a brief, clear summary that explains:
1. What files were changed
2. What was added, removed, or modified
3. The likely purpose of these changes

Keep it concise (3-5 bullet points). Focus on the "what" and "why".

{context}

DIFF:
\`\`\`
{diff}
\`\`\`

Provide only the summary, no additional commentary.`;

const KARMA_PROMPT = `Analyze the git diff below and create a commit message following Karma convention.

FORMAT: <type>(<scope>): <subject>

TYPES (use the most appropriate):
- feat: new feature or capability
- fix: bug fix
- docs: documentation changes (README, comments, docstrings)
- style: formatting only (whitespace, semicolons)
- refactor: code change that neither fixes bug nor adds feature
- test: adding or modifying tests
- build: build system, dependencies, package config
- chore: maintenance tasks

RULES:
- Scope is optional - use the main file/module name if relevant
- Subject must describe WHAT changed in the diff, not a generic message
- Use imperative mood: "add" not "added", "fix" not "fixed"
- Lowercase, no period at end, max 72 chars

EXAMPLES based on diff content:
- Adding README.md → docs: add README with usage instructions
- Fixing null check in auth.py → fix(auth): handle null user in login
- New API endpoint → feat(api): add user profile endpoint
- Updating dependencies → build: update httpx to 0.25.0

IMPORTANT: Base your message ONLY on the actual changes shown in the diff below.
Do NOT use the examples above if they don't match the diff content.

{constraints}

{context}

DIFF TO ANALYZE:
\`\`\`
{diff}
\`\`\`

Reply with ONLY the commit message, nothing else. No quotes, no explanation.`;

export interface PromptConstraints {
  type?: string;
  scope?: string;
  language?: string;
  breaking?: boolean;
  context?: string;
}

const VALID_TYPES = ["feat", "fix", "docs", "style", "refactor", "test", "chore", "build", "ci", "perf", "revert"];

export function isValidType(type: string): boolean {
  return VALID_TYPES.includes(type.toLowerCase());
}

export function getValidTypes(): string[] {
  return [...VALID_TYPES];
}

function buildConstraintsText(constraints: PromptConstraints): string {
  const parts: string[] = [];

  if (constraints.type) {
    parts.push(`CONSTRAINT: You MUST use "${constraints.type}" as the commit type.`);
  }

  if (constraints.scope) {
    parts.push(`CONSTRAINT: You MUST use "(${constraints.scope})" as the scope in the commit message.`);
  }

  if (constraints.breaking) {
    parts.push(`CONSTRAINT: This is a BREAKING CHANGE. You MUST use "!" after the type/scope (e.g., "feat!:" or "feat(api)!:").`);
  }

  if (constraints.language) {
    const langMap: Record<string, string> = {
      en: "English",
      pt: "Portuguese",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      ja: "Japanese",
      zh: "Chinese",
      ko: "Korean",
      ru: "Russian",
    };
    const langName = langMap[constraints.language.toLowerCase()] || constraints.language;
    parts.push(`CONSTRAINT: Write the commit message subject in ${langName}.`);
  }

  if (constraints.context) {
    parts.push(`ADDITIONAL CONTEXT: ${constraints.context}`);
  }

  return parts.join("\n");
}

const KARMA_PATTERN =
  /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\([^)]+\))?:\s*.+/;

const ACTION_TO_TYPE: Record<string, string> = {
  add: "feat",
  added: "feat",
  adding: "feat",
  create: "feat",
  implement: "feat",
  fix: "fix",
  fixed: "fix",
  fixing: "fix",
  repair: "fix",
  update: "refactor",
  updated: "refactor",
  updating: "refactor",
  improve: "refactor",
  remove: "refactor",
  removed: "refactor",
  removing: "refactor",
  delete: "refactor",
  document: "docs",
  documented: "docs",
  test: "test",
  tested: "test",
  testing: "test",
};

const MAX_DIFF_CHARS = 8000;

export function truncateDiff(diff: string, maxChars = MAX_DIFF_CHARS): string {
  if (diff.length <= maxChars) {
    return diff;
  }

  let truncated = diff.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > maxChars * 0.8) {
    truncated = truncated.slice(0, lastNewline);
  }

  return truncated + "\n\n[... diff truncated for brevity ...]";
}

export function buildPrompt(diff: string, context: string, constraints?: PromptConstraints): string {
  const truncatedDiff = truncateDiff(diff);
  const constraintsText = constraints ? buildConstraintsText(constraints) : "";
  return KARMA_PROMPT
    .replace("{diff}", truncatedDiff)
    .replace("{context}", context)
    .replace("{constraints}", constraintsText);
}

export function buildSummarizePrompt(diff: string, context: string): string {
  const truncatedDiff = truncateDiff(diff);
  return SUMMARIZE_PROMPT.replace("{diff}", truncatedDiff).replace("{context}", context);
}

export function validateMessage(message: string): boolean {
  return KARMA_PATTERN.test(message.trim());
}

export function cleanMessage(message: string): string {
  // Take only the first line
  let cleaned = message.trim().split("\n")[0];

  // Remove common prefixes that models sometimes add
  const prefixes = ["Here is ", "I've ", "The commit message is:", "Commit message:", "Here's "];

  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length);
    }
  }

  // Strip whitespace and trailing period
  cleaned = cleaned.trim().replace(/\.$/, "");

  return cleaned;
}

export function fixMessage(message: string): string {
  const cleaned = cleanMessage(message);

  // If already valid, return as-is
  if (validateMessage(cleaned)) {
    return cleaned;
  }

  // Try to infer type from first word
  const words = cleaned.split(/\s+/);
  if (words.length > 0) {
    const firstWord = words[0].toLowerCase().replace(/:$/, "");
    const commitType = ACTION_TO_TYPE[firstWord] ?? "chore";

    // Build the message
    const subject = words.join(" ").toLowerCase();
    if (!subject.endsWith(":")) {
      return `${commitType}: ${subject}`;
    }
  }

  return `chore: ${cleaned.toLowerCase()}`;
}

export function addIssueReference(message: string, issue: string): string {
  // Normalize issue format - support #123 or just 123
  const issueRef = issue.startsWith("#") ? issue : `#${issue}`;
  return `${message}\n\nRefs: ${issueRef}`;
}

export function addCoAuthors(message: string, coAuthors: string[]): string {
  if (coAuthors.length === 0) {
    return message;
  }
  const trailers = coAuthors.map((author) => `Co-authored-by: ${author}`).join("\n");
  return `${message}\n\n${trailers}`;
}

export function ensureBreakingMarker(message: string): string {
  // Check if message already has breaking marker
  if (message.includes("!:")) {
    return message;
  }
  // Add ! before the colon
  return message.replace(/:/, "!:");
}
