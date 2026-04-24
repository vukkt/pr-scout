# pr-scout

A command-line tool that fetches open `good first issue` tickets from any GitHub repository, scores each one using an LLM, and presents an interactive list so you can open the most promising issue directly in your browser.

It filters out spam, farm issues, and stale repos. Each issue is scored 0–10 with a verdict (green / yellow / red), a scope estimate, and a one-sentence rationale.

---

## Requirements

- Node.js 20 or later
- A [Groq API key](https://console.groq.com) (free tier is sufficient)
- A GitHub personal access token (optional — unauthenticated requests are rate-limited to 60/hr, which is enough for casual use)

---

## Installation

Install globally from npm:

```bash
npm install -g pr-scout
```

Or run without installing via npx:

```bash
npx pr-scout <owner>/<repo>
```

---

## Configuration

pr-scout reads credentials from environment variables. Add them to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export GROQ_API_KEY=gsk_...
export GITHUB_TOKEN=ghp_...   # optional but recommended
```

| Variable       | Required | Description                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `GROQ_API_KEY` | Yes      | Groq API key. Free tier at [console.groq.com](https://console.groq.com).    |
| `GITHUB_TOKEN` | No       | GitHub personal access token. Without it, API calls are capped at 60/hr.   |

### Creating a GitHub token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select the `public_repo` scope (read-only access to public repositories)
4. Copy the token and export it as `GITHUB_TOKEN`

No additional scopes are needed for public repositories.

---

## Usage

```bash
pr-scout <owner>/<repo>
```

Examples:

```bash
pr-scout storybookjs/storybook
pr-scout vitejs/vite
pr-scout vercel/next.js
```

pr-scout will:

1. Fetch up to 50 open, unassigned issues labeled `good first issue`
2. Pull repository health signals (stars, recent commits, merged PRs, CONTRIBUTING.md)
3. Score each issue using Llama 3.3 70B via Groq
4. Present the top 10 results as an interactive list
5. Open the selected issue in your default browser

---

## Scoring

Each issue is evaluated on five criteria:

- **Clarity** — Is the problem well-defined and actionable without asking follow-up questions?
- **Scope** — Is the change self-contained, or does it require deep familiarity with the codebase?
- **Spam signals** — Does it look like a contribution-farm issue (name lists, translation stubs, no real problem statement)?
- **Repo health** — Is the project actively maintained and likely to review a PR?
- **Actionability** — Is there a clear path to a solution?

Results are sorted by score descending. Each row shows the score, verdict, scope estimate, issue title, and a one-sentence rationale.

| Verdict | Score range | Meaning                                          |
| ------- | ----------- | ------------------------------------------------ |
| green   | 7 – 10      | Clear, scoped, active repo — worth diving in     |
| yellow  | 4 – 6       | Some ambiguity or risk, but not a dealbreaker    |
| red     | 0 – 3       | Spam, dead repo, too vague, or requires deep expertise |

| Scope   | Meaning                                                  |
| ------- | -------------------------------------------------------- |
| S       | A few lines of code, single file, well-understood fix    |
| M       | Touches multiple files or requires some design thinking  |
| L       | Significant feature, refactor, or unclear boundaries     |
| ?       | Cannot be determined from the issue description          |

---

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/vukkt/pr-scout.git
cd pr-scout
npm install
```

Run in development mode (no build step required):

```bash
npm run dev -- storybookjs/storybook
```

Build the distributable:

```bash
npm run build
```

The compiled binary is written to `dist/index.js`.

---

## License

MIT
