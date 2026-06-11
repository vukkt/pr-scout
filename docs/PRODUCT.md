# pr-scout — Product Lifecycle

A living document covering the engineering lifecycle of pr-scout end to end: who it serves, what it must do, how it is designed, how quality is assured, how it ships, and where it goes next.

## Problem & users

**Users:** new open-source contributors looking for a first (or fifth) contribution.

**Problem:** "good first issue" lists are polluted. They mix genuinely approachable tickets with contribution-farm spam (name lists, translation stubs), issues in repos nobody maintains anymore, vague one-liners, and tickets that quietly require deep codebase expertise. Triaging them by hand means opening dozens of tabs and guessing.

**Job to be done:** given a repo, surface the few issues actually worth a newcomer's time — scored, ranked, and one keypress away from opening in the browser.

## Requirements

### Functional

- Fetch open, unassigned issues with a given label (default `good first issue`) from any public GitHub repo, capped at a configurable limit (1–100, default 50).
- Pull repo health signals: stars, commits and merged PRs in the last 30 days, presence of CONTRIBUTING.md.
- Score each issue 0–10 with an LLM, producing a verdict (green/yellow/red), scope estimate (S/M/L/?), and one-sentence rationale.
- Rank by score and present the top N (default 10) in an interactive picker that opens the selection in the browser.
- `--json` mode: print all scored results as JSON to stdout for scripting; no interactivity.

### Non-functional

- **Free-tier friendly** — works on Groq's free tier and GitHub's unauthenticated API.
- **Fast enough** — a 50-issue run completes in under a minute.
- **No stored data** — nothing is cached or persisted; every run is stateless.
- **Graceful degradation** — without `GITHUB_TOKEN`, warn about the 60 req/hr cap and continue rather than fail.

## Design

### Module map (`src/`)

| Module         | Responsibility                                                     |
| -------------- | ------------------------------------------------------------------ |
| `index.ts`     | CLI wiring: argument/option parsing, orchestration, exit codes      |
| `github.ts`    | Data access: issue fetching, repo health, GitHub error translation  |
| `prompt.ts`    | Prompt construction from issue + repo health                        |
| `evaluator.ts` | LLM call via Groq + strict response validation (`parseScore`)       |
| `ui.ts`        | Presentation: spinner, interactive picker                           |
| `types.ts`     | Shared contracts: `Issue`, `RepoHealth`, `Score`, `ScoredIssue`     |

### Key decisions

- **Groq free tier over OpenAI.** The target user is a newcomer who shouldn't need a paid API key to find their first issue. Groq's OpenAI-compatible endpoint means the `openai` SDK still works with just a `baseURL` override.
- **Strict JSON schema validation with rejection over lenient parsing.** `parseScore` strips code fences, then rejects anything that isn't a well-formed score object with a known verdict and scope. A wrong-but-plausible score is worse than no score: it silently corrupts the ranking the whole tool exists to provide.
- **Sequential scoring over parallel.** Issues are scored one at a time to stay within Groq free-tier rate limits. Slower, but it never trips 429s on the tier the tool is designed for.
- **Skip-on-failure per issue.** If one issue fails to score (bad model output, transient error), it is dropped and the run continues. One flaky response shouldn't abort 49 good ones.

## Quality strategy

- **Unit tests** (`tests/`, vitest) cover the deterministic surface with mocked boundaries: GitHub response mapping and error translation, prompt construction, and `parseScore` validation — no network, no LLM.
- **CI gates** (`.github/workflows/ci.yml`): typecheck, tests, and build run on every push and PR.

## Release

- **Versioning:** semver. 0.2.0 added CLI options and `--json` — additive, so a minor bump.
- **Changelog:** every release gets an entry in `CHANGELOG.md` (Keep a Changelog format).
- **Publish flow:** bump version → update changelog → `npm publish`. The `prepublishOnly` script runs `npm run build` so the published package always contains a fresh `dist/`. Only `dist`, `README.md`, and `LICENSE` ship in the tarball.

## Maintenance & roadmap

### Known limits

- Single label per query — no combining `good first issue` with `help wanted` in one run.
- English-centric prompt — scoring quality on non-English issues is unmeasured.
- Model drift — Groq model updates can shift scoring behavior; spot-check scoring after any model or prompt change.

### Candidate next steps

- Multi-label queries.
- A golden-dataset benchmark to measure LLM scoring quality and catch model drift.
- Score caching keyed by issue updated-at, to make repeat runs on the same repo cheap.
- Scanning multiple repos in one invocation (e.g. an org or a topic).
