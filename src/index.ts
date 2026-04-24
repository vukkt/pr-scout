import { Command } from "commander";
import { fetchIssues, fetchRepoHealth } from "./github.js";
import { evaluateIssue } from "./evaluator.js";
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

const program = new Command();

program
  .name("pr-scout")
  .description("Find and score good first issues in any GitHub repo")
  .argument("<repo>", "GitHub repo in owner/repo format, e.g. shadcn-ui/ui")
  .action(async (repoArg: string) => {
    validateEnv();
    const { owner, repo } = parseRepo(repoArg);
    const sp = makeSpinner();

    try {
      sp.start("Fetching issues and repo health…");
      const [issues, health] = await Promise.all([
        fetchIssues(owner, repo),
        fetchRepoHealth(owner, repo),
      ]);
      sp.stop(`Found ${issues.length} open good first issue${issues.length !== 1 ? "s" : ""}`);

      if (issues.length === 0) {
        await promptIssueSelect(`${owner}/${repo}`, []);
        return;
      }

      sp.start(`Scoring 1 / ${issues.length}…`);
      const scored: ScoredIssue[] = [];

      for (let i = 0; i < issues.length; i++) {
        sp.message(`Scoring ${i + 1} / ${issues.length} — ${issues[i].title.slice(0, 60)}`);
        try {
          const score = await evaluateIssue(issues[i], health);
          scored.push({ issue: issues[i], score });
        } catch {
          // skip issues that fail to score rather than aborting the whole run
        }
      }

      sp.stop(`Scored ${scored.length} issue${scored.length !== 1 ? "s" : ""}`);

      scored.sort((a, b) => b.score.score - a.score.score);

      await promptIssueSelect(`${owner}/${repo}`, scored);
    } catch (error) {
      sp.stop("Failed", 1);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exit(1);
    }
  });

program.parse();
