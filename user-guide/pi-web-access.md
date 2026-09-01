# Pi Web Access

## Purpose

`npm:pi-web-access` provides web research and source-fetching tools used by Pi.

Common tools include:

- `web_search` — search the web with citations/summaries.
- `source_check` — verify a claim against web sources with passage evidence.
- `fetch_content` — fetch readable/raw URL content, GitHub repos, PDFs, and videos.
- `get_search_content` — retrieve stored content slices from previous web calls.

## Current status

Installed and verified 2026-09-01 at version `0.27.0`.

This is separate from the local `web_fetch` extension. Use:

- `web_search` / `source_check` for research and citations.
- `fetch_content` for richer URL/content handling.
- local `web_fetch` for simple clean Markdown extraction.

## Usage examples

Research with varied queries:

```json
{
  "queries": [
    "Pi coding agent extensions documentation",
    "pi-subagents workflowScript examples"
  ],
  "numResults": 5
}
```

Check a claim:

```json
{
  "claim": "Pi loads AGENTS.md or CLAUDE.md as project context.",
  "fetchContent": true
}
```

Fetch a URL:

```json
{
  "url": "https://example.com",
  "mode": "readable"
}
```

## Update

```bash
pi update --extensions
```

Then `/reload` or restart Pi.

## Caveats

- Search providers depend on local config/auth.
- For comprehensive research, use 2–4 varied `queries` rather than one broad query.
- Use exact passage citations for claims that matter.
