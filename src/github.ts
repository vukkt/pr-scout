import { Octokit } from "@octokit/rest";
import type { Issue, RepoHealth } from "./types.js";

function createClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("Warning: GITHUB_TOKEN not set — using unauthenticated API (60 req/hr limit).");
  }
  return new Octokit({ auth: token });
}

function handleGitHubError(error: unknown, owner: string, repo: string): never {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found. Check the name and your token permissions.`);
    }
    if (status === 401) {
      throw new Error("GitHub token is invalid or expired. Check your GITHUB_TOKEN.");
    }
    if (status === 403) {
      const msg = (error as { message?: string }).message ?? "";
      if (msg.toLowerCase().includes("rate limit")) {
        throw new Error("GitHub API rate limit exceeded. Wait a few minutes and try again.");
      }
      throw new Error(`GitHub API returned 403 Forbidden. Your token may lack repo read permissions.`);
    }
  }
  throw error;
}

export interface FetchIssuesOptions {
  label: string;
  limit: number;
}

export const DEFAULT_LABEL = "good first issue";

export async function fetchIssues(
  owner: string,
  repo: string,
  options: FetchIssuesOptions = { label: DEFAULT_LABEL, limit: 50 }
): Promise<Issue[]> {
  const octokit = createClient();

  try {
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      labels: options.label,
      assignee: "none",
      sort: "created",
      direction: "desc",
      per_page: options.limit,
    });

    // listForRepo returns PRs too — filter them out
    return data
      .filter((item) => !item.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        url: issue.html_url,
        createdAt: issue.created_at,
        labels: issue.labels
          .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
          .filter(Boolean),
      }));
  } catch (error) {
    handleGitHubError(error, owner, repo);
  }
}

export async function fetchRepoHealth(owner: string, repo: string): Promise<RepoHealth> {
  const octokit = createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [repoData, commits, closedPRs, contributing] = await Promise.all([
      octokit.repos.get({ owner, repo }),

      octokit.repos.listCommits({ owner, repo, since, per_page: 100 }),

      octokit.pulls.list({ owner, repo, state: "closed", sort: "updated", direction: "desc", per_page: 100 }),

      octokit.repos.getContent({ owner, repo, path: "CONTRIBUTING.md" }).then(() => true).catch(() => false),
    ]);

    const mergedPRsLast30Days = closedPRs.data.filter(
      (pr) => pr.merged_at !== null && new Date(pr.merged_at) >= new Date(since)
    ).length;

    return {
      stars: repoData.data.stargazers_count,
      commitsLast30Days: commits.data.length,
      mergedPRsLast30Days,
      hasContributing: contributing,
    };
  } catch (error) {
    handleGitHubError(error, owner, repo);
  }
}
