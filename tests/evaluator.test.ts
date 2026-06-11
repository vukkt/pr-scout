import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateIssue, parseScore } from "../src/evaluator.js";
import type { Issue, RepoHealth } from "../src/types.js";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

const issue: Issue = {
  number: 42,
  title: "Fix typo in README",
  body: "There is a typo in the installation section.",
  url: "https://github.com/acme/widget/issues/42",
  createdAt: "2026-01-15T00:00:00Z",
  labels: ["good first issue", "docs"],
};

const health: RepoHealth = {
  stars: 1200,
  commitsLast30Days: 34,
  mergedPRsLast30Days: 12,
  hasContributing: true,
};

describe("parseScore", () => {
  it("parses a valid response", () => {
    const raw = JSON.stringify({
      score: 8,
      verdict: "green",
      reasoning: "Clear and scoped.",
      estimatedScope: "small",
    });
    expect(parseScore(raw)).toEqual({
      score: 8,
      verdict: "green",
      reasoning: "Clear and scoped.",
      estimatedScope: "small",
    });
  });

  it("strips markdown code fences", () => {
    const raw =
      '```json\n{"score": 5, "verdict": "yellow", "reasoning": "Some ambiguity.", "estimatedScope": "medium"}\n```';
    expect(parseScore(raw).verdict).toBe("yellow");
  });

  it("rounds fractional scores", () => {
    const raw = JSON.stringify({
      score: 6.7,
      verdict: "yellow",
      reasoning: "Okay.",
      estimatedScope: "unknown",
    });
    expect(parseScore(raw).score).toBe(7);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseScore("not json at all")).toThrow(/invalid JSON/);
  });

  it("rejects a response missing required fields", () => {
    expect(() => parseScore('{"score": 5}')).toThrow(/unexpected schema/);
  });

  it("rejects an unknown verdict", () => {
    const raw = JSON.stringify({
      score: 5,
      verdict: "purple",
      reasoning: "?",
      estimatedScope: "small",
    });
    expect(() => parseScore(raw)).toThrow(/Invalid verdict/);
  });

  it("rejects an unknown scope", () => {
    const raw = JSON.stringify({
      score: 5,
      verdict: "green",
      reasoning: "?",
      estimatedScope: "gigantic",
    });
    expect(() => parseScore(raw)).toThrow(/Invalid scope/);
  });
});

describe("evaluateIssue", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    createMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends system and user messages and parses the reply", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 9,
              verdict: "green",
              reasoning: "Trivial fix in an active repo.",
              estimatedScope: "small",
            }),
          },
        },
      ],
    });

    const score = await evaluateIssue(issue, health);

    expect(score.score).toBe(9);
    expect(createMock).toHaveBeenCalledTimes(1);
    const request = createMock.mock.calls[0][0];
    expect(request.messages).toHaveLength(2);
    expect(request.messages[0].role).toBe("system");
    expect(request.messages[1].content).toContain("Fix typo in README");
  });

  it("passes the requested model to the API, defaulting to llama-3.3-70b-versatile", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 7,
              verdict: "yellow",
              reasoning: "Reasonable starter task.",
              estimatedScope: "medium",
            }),
          },
        },
      ],
    });

    await evaluateIssue(issue, health);
    expect(createMock.mock.calls[0][0].model).toBe("llama-3.3-70b-versatile");

    await evaluateIssue(issue, health, "llama-3.1-8b-instant");
    expect(createMock.mock.calls[1][0].model).toBe("llama-3.1-8b-instant");
  });

  it("throws when the model returns no content", async () => {
    createMock.mockResolvedValue({ choices: [] });
    await expect(evaluateIssue(issue, health)).rejects.toThrow(/invalid JSON/);
  });

  it("throws when GROQ_API_KEY is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(evaluateIssue(issue, health)).rejects.toThrow(/GROQ_API_KEY/);
  });
});
