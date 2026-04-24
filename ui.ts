import { intro, outro, select, spinner, isCancel } from "@clack/prompts";
import open from "open";
import type { ScoredIssue, Verdict, Scope } from "./types.js";

const VERDICT_EMOJI: Record<Verdict, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const SCOPE_LABEL: Record<Scope, string> = {
  small: "S",
  medium: "M",
  large: "L",
  unknown: "?",
};

function formatLabel(si: ScoredIssue): string {
  const emoji = VERDICT_EMOJI[si.score.verdict];
  const scope = SCOPE_LABEL[si.score.estimatedScope];
  return `${si.score.score}/10 ${emoji}  [${scope}]  ${si.issue.title}`;
}

export function makeSpinner() {
  return spinner();
}

export async function promptIssueSelect(
  repo: string,
  issues: ScoredIssue[]
): Promise<void> {
  intro(`pr-scout — ${repo}`);

  if (issues.length === 0) {
    outro("No good first issues found for this repo.");
    return;
  }

  const top = issues.slice(0, 10);

  const selected = await select<ScoredIssue>({
    message: "Pick an issue to open  (↑↓ navigate · Enter select · Ctrl+C quit)",
    options: top.map((si) => ({
      value: si,
      label: formatLabel(si),
      hint: si.score.reasoning,
    })),
  });

  if (isCancel(selected)) {
    outro("Cancelled.");
    return;
  }

  const { issue } = selected;
  outro(`Opening #${issue.number} in your browser…`);
  await open(issue.url);
}
