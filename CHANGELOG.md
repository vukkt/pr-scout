# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-11

### Added

- CLI options: `-l, --label` (issue label to filter by), `-n, --limit` (max issues to fetch and score, 1–100), `-t, --top` (number of results shown in the picker), `-m, --model` (Groq model id)
- `--json` flag to print scored results as JSON to stdout for scripting, sorted by score descending
- Product lifecycle docs (`docs/PRODUCT.md`)

## [0.1.0] - 2026-04-24

### Added

- Initial release: fetch open `good first issue` tickets from any public GitHub repo, score each with an LLM via Groq, and present an interactive picker that opens the selected issue in the browser

[0.2.0]: https://github.com/vukkt/pr-scout/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vukkt/pr-scout/releases/tag/v0.1.0
