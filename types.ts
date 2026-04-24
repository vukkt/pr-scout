export interface Issue {
  number: number;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
  labels: string[];
}

export interface RepoHealth {
  stars: number;
  commitsLast30Days: number;
  mergedPRsLast30Days: number;
  hasContributing: boolean;
}

export type Verdict = "green" | "yellow" | "red";
export type Scope = "small" | "medium" | "large" | "unknown";

export interface Score {
  score: number;
  verdict: Verdict;
  reasoning: string;
  estimatedScope: Scope;
}

export interface ScoredIssue {
  issue: Issue;
  score: Score;
}
