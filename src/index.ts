import { Command } from "commander";
import { DEFAULT_LABEL, fetchIssues, fetchRepoHealth } from "./github.js";
import { DEFAULT_MODEL, evaluateIssue } from "./evaluator.js";
import { makeSpinner, promptIssueSelect } from "./ui.js";
import type { ScoredIssue } from "./types.js";

function validateEnv(): void {
  if (!process.env.GROQ_API_KEY) {
    console.error("Error: GROQ_API_KEY is not set. Get a free key at console.groq.com");
    process.exit(1);
  }
}

function parseRepo(arg: string): { owner: string; repo: string } {
  const parts = arg.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error(`Error: Invalid repo format "${arg}". Expected owner/repo (e.g. shadcn-ui/ui)`);
    process.exit(1);
  }
  return { owner: parts[0], repo: parts[1] };
}

function parseIntOption(value: string, name: string, min: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    const expected = max !== undefined ? `an integer between ${min} and ${max}` : `an integer >= ${min}`;
    console.error(`Error: Invalid ${name} "${value}". Expected ${expected}`);
    process.exit(1);
  }
  return parsed;
}

interface CliOptions {
  label: string;
  limit: string;
  top: string;
  model: string;
  json?: boolean;
}

const program = new Command();

program
  .name("pr-scout")
  .description("Find and score good first issues in any GitHub repo")
  .argument("<repo>", "GitHub repo in owner/repo format, e.g. shadcn-ui/ui")
  .option("-l, --label <label>", "issue label to filter by", DEFAULT_LABEL)
  .option("-n, --limit <count>", "max issues to fetch and score (1-100)", "50")
  .option("-t, --top <count>", "number of results shown in the picker", "10")
  .option("-m, --model <model>", "Groq model id", DEFAULT_MODEL)
  .option("--json", "print results as JSON to stdout instead of the interactive picker")
  .action(async (repoArg: string, opts: CliOptions) => {
    validateEnv();
    const { owner, repo } = parseRepo(repoArg);
    const limit = parseIntOption(opts.limit, "limit", 1, 100);
    const top = parseIntOption(opts.top, "top", 1);
    const sp = opts.json ? null : makeSpinner();

    try {
      sp?.start("Fetching issues and repo health…");
      const [issues, health] = await Promise.all([
        fetchIssues(owner, repo, { label: opts.label, limit }),
        fetchRepoHealth(owner, repo),
      ]);
      sp?.stop(`Found ${issues.length} open "${opts.label}" issue${issues.length !== 1 ? "s" : ""}`);

      const scored: ScoredIssue[] = [];

      if (issues.length > 0) {
        sp?.start(`Scoring 1 / ${issues.length}…`);
        for (let i = 0; i < issues.length; i++) {
          sp?.message(`Scoring ${i + 1} / ${issues.length} — ${issues[i].title.slice(0, 60)}`);
          try {
            const score = await evaluateIssue(issues[i], health, opts.model);
            scored.push({ issue: issues[i], score });
          } catch {
            // skip issues that fail to score rather than aborting the whole run
          }
        }
        sp?.stop(`Scored ${scored.length} issue${scored.length !== 1 ? "s" : ""}`);
      }

      scored.sort((a, b) => b.score.score - a.score.score);

      if (opts.json) {
        const output = {
          repo: `${owner}/${repo}`,
          label: opts.label,
          model: opts.model,
          issues: scored.map(({ issue, score }) => ({
            number: issue.number,
            title: issue.title,
            url: issue.url,
            score: score.score,
            verdict: score.verdict,
            estimatedScope: score.estimatedScope,
            reasoning: score.reasoning,
          })),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      await promptIssueSelect(`${owner}/${repo}`, scored, top);
    } catch (error) {
      sp?.stop("Failed", 1);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exit(1);
    }
  });

program.parse();
