import type { Issue, RepoHealth } from "./types.js";

export function buildSystemPrompt(): string {
  return `You are evaluating GitHub issues to determine how suitable they are for first-time contributors to open source projects.

Score each issue as a "good first issue" candidate. Consider:

1. **Clarity** — Is the problem well-defined? Could someone new understand what needs to be done without asking questions?
2. **Scope** — Is this self-contained? Or does it require deep knowledge of many subsystems?
3. **Spam/farm signals** — Does it look auto-generated, vague, or designed to farm contributions rather than improve the project? (e.g. "add your name to the list", "translate this file", no real problem statement)
4. **Repo health** — Is this an active project likely to review and merge a PR? Dead repos waste contributors' time.
5. **Actionability** — Is there a clear path to a solution, or is it an open-ended discussion?

## Output format
Respond with ONLY valid JSON. No explanation, no markdown, no code fences.

{
  "score": <integer 0-10>,
  "verdict": <"green" | "yellow" | "red">,
  "reasoning": <one sentence, max 20 words, plain text>,
  "estimatedScope": <"small" | "medium" | "large" | "unknown">
}

Verdict guide:
- green (7-10): Clear, scoped, active repo — worth diving in
- yellow (4-6): Some ambiguity or risk, but not a dealbreaker
- red (0-3): Spam, dead repo, too vague, or requires deep expertise

Scope guide:
- small: a few lines of code, single file, well-understood fix
- medium: touches multiple files or requires some design thinking
- large: significant feature, refactor, or unclear boundaries
- unknown: can't tell from the issue description`;
}

export function buildUserMessage(issue: Issue, health: RepoHealth): string {
  return `## Repository context
- Stars: ${health.stars.toLocaleString()}
- Commits in last 30 days: ${health.commitsLast30Days}
- Merged PRs in last 30 days: ${health.mergedPRsLast30Days}
- Has CONTRIBUTING.md: ${health.hasContributing}

## Issue
Title: ${issue.title}
Labels: ${issue.labels.join(", ") || "none"}
Created: ${issue.createdAt}

Body:
${issue.body?.trim() || "(no description provided)"}`;
}
