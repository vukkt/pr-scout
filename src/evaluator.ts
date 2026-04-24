import OpenAI from "openai";
import { buildSystemPrompt, buildUserMessage } from "./prompt.js";
import type { Issue, RepoHealth, Score, Verdict, Scope } from "./types.js";

const VERDICTS: readonly Verdict[] = ["green", "yellow", "red"];
const SCOPES: readonly Scope[] = ["small", "medium", "large", "unknown"];

function createClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — get a free key at console.groq.com");
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

function parseScore(raw: string): Score {
  // Strip markdown code fences if the model wraps its output
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new Error(`Model returned invalid JSON:\n${raw.slice(0, 300)}`);
  }

  const obj = json as Record<string, unknown>;

  if (
    typeof obj.score !== "number" ||
    typeof obj.verdict !== "string" ||
    typeof obj.reasoning !== "string" ||
    typeof obj.estimatedScope !== "string"
  ) {
    throw new Error(`Model returned unexpected schema: ${JSON.stringify(obj)}`);
  }

  if (!VERDICTS.includes(obj.verdict as Verdict)) {
    throw new Error(`Invalid verdict "${obj.verdict}" — expected one of ${VERDICTS.join(", ")}`);
  }
  if (!SCOPES.includes(obj.estimatedScope as Scope)) {
    throw new Error(`Invalid scope "${obj.estimatedScope}" — expected one of ${SCOPES.join(", ")}`);
  }

  return {
    score: Math.round(obj.score),
    verdict: obj.verdict as Verdict,
    reasoning: obj.reasoning,
    estimatedScope: obj.estimatedScope as Scope,
  };
}

export async function evaluateIssue(issue: Issue, health: RepoHealth): Promise<Score> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 256,
    temperature: 0,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserMessage(issue, health) },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return parseScore(text);
}
