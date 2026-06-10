import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "../src/prompt.js";
import type { Issue, RepoHealth } from "../src/types.js";

const health: RepoHealth = {
  stars: 15000,
  commitsLast30Days: 87,
  mergedPRsLast30Days: 23,
  hasContributing: true,
};

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    number: 7,
    title: "Add dark mode toggle",
    body: "We need a toggle in settings.",
    url: "https://github.com/acme/widget/issues/7",
    createdAt: "2026-02-01T00:00:00Z",
    labels: ["good first issue", "ui"],
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("describes the JSON output contract", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"estimatedScope"');
    expect(prompt).toContain("green");
    expect(prompt).toContain("red");
  });
});

describe("buildUserMessage", () => {
  it("includes repo health and issue details", () => {
    const message = buildUserMessage(makeIssue(), health);
    expect(message).toContain("15,000");
    expect(message).toContain("Commits in last 30 days: 87");
    expect(message).toContain("Merged PRs in last 30 days: 23");
    expect(message).toContain("Has CONTRIBUTING.md: true");
    expect(message).toContain("Add dark mode toggle");
    expect(message).toContain("good first issue, ui");
  });

  it("falls back when the body is null", () => {
    const message = buildUserMessage(makeIssue({ body: null }), health);
    expect(message).toContain("(no description provided)");
  });

  it("falls back when the body is whitespace", () => {
    const message = buildUserMessage(makeIssue({ body: "   \n  " }), health);
    expect(message).toContain("(no description provided)");
  });

  it("reports 'none' when there are no labels", () => {
    const message = buildUserMessage(makeIssue({ labels: [] }), health);
    expect(message).toContain("Labels: none");
  });
});
