import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchIssues, fetchRepoHealth } from "../src/github.js";

const mocks = vi.hoisted(() => ({
  listForRepo: vi.fn(),
  reposGet: vi.fn(),
  listCommits: vi.fn(),
  getContent: vi.fn(),
  pullsList: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    issues = { listForRepo: mocks.listForRepo };
    repos = {
      get: mocks.reposGet,
      listCommits: mocks.listCommits,
      getContent: mocks.getContent,
    };
    pulls = { list: mocks.pullsList };
  },
}));

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("fetchIssues", () => {
  it("maps issues and filters out pull requests", async () => {
    mocks.listForRepo.mockResolvedValue({
      data: [
        {
          number: 1,
          title: "Real issue",
          body: "Details",
          html_url: "https://github.com/acme/widget/issues/1",
          created_at: "2026-03-01T00:00:00Z",
          labels: ["good first issue", { name: "bug" }, { name: null }],
        },
        {
          number: 2,
          title: "Actually a PR",
          body: null,
          html_url: "https://github.com/acme/widget/pull/2",
          created_at: "2026-03-02T00:00:00Z",
          labels: [],
          pull_request: {},
        },
      ],
    });

    const issues = await fetchIssues("acme", "widget");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({
      number: 1,
      title: "Real issue",
      body: "Details",
      url: "https://github.com/acme/widget/issues/1",
      createdAt: "2026-03-01T00:00:00Z",
      labels: ["good first issue", "bug"],
    });
    expect(mocks.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ labels: "good first issue", per_page: 50 })
    );
  });

  it("passes a custom label and limit to the GitHub API", async () => {
    mocks.listForRepo.mockResolvedValue({ data: [] });

    await fetchIssues("acme", "widget", { label: "help wanted", limit: 25 });

    expect(mocks.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ labels: "help wanted", per_page: 25 })
    );
  });

  it("translates a 404 into a friendly error", async () => {
    mocks.listForRepo.mockRejectedValue({ status: 404 });
    await expect(fetchIssues("acme", "missing")).rejects.toThrow(
      /acme\/missing not found/
    );
  });

  it("translates a rate-limit 403 into a friendly error", async () => {
    mocks.listForRepo.mockRejectedValue({
      status: 403,
      message: "API rate limit exceeded",
    });
    await expect(fetchIssues("acme", "widget")).rejects.toThrow(/rate limit/);
  });
});

describe("fetchRepoHealth", () => {
  it("aggregates stars, commits, merged PRs, and CONTRIBUTING.md", async () => {
    const now = Date.now();
    const recent = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

    mocks.reposGet.mockResolvedValue({ data: { stargazers_count: 321 } });
    mocks.listCommits.mockResolvedValue({ data: [{}, {}, {}] });
    mocks.pullsList.mockResolvedValue({
      data: [
        { merged_at: recent },
        { merged_at: stale },
        { merged_at: null },
      ],
    });
    mocks.getContent.mockResolvedValue({ data: {} });

    const health = await fetchRepoHealth("acme", "widget");

    expect(health).toEqual({
      stars: 321,
      commitsLast30Days: 3,
      mergedPRsLast30Days: 1,
      hasContributing: true,
    });
  });

  it("reports hasContributing false when the file is missing", async () => {
    mocks.reposGet.mockResolvedValue({ data: { stargazers_count: 0 } });
    mocks.listCommits.mockResolvedValue({ data: [] });
    mocks.pullsList.mockResolvedValue({ data: [] });
    mocks.getContent.mockRejectedValue({ status: 404 });

    const health = await fetchRepoHealth("acme", "widget");
    expect(health.hasContributing).toBe(false);
  });
});
