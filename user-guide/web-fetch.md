# Web Fetch

## Purpose

`web_fetch` fetches a URL and converts readable page content to clean Markdown. It is useful for documentation pages, blog posts, PDFs/plain text that Pi can fetch, and quick source inspection without browser noise.

## Current status

Vendored local extension:

```text
extensions/web-fetch/
```

Installed live under the host Pi runtime:

```text
~/.pi/agent/extensions/web-fetch/
```

Verified 2026-09-01 with `https://example.com`.

## Usage

From an agent/tool call, use:

```json
{
  "url": "https://example.com"
}
```

The returned content is Markdown extracted from the page.

## Reinstall/update from this repo

Run from `pi_setting`:

```bash
./scripts/install-packages.sh
```

That copies the vendored extension to `~/.pi/agent/extensions/web-fetch/` and runs `npm install` in the extension directory.

After changing or reinstalling the extension, run `/reload` or restart Pi.

## Smoke test

Ask Pi to fetch:

```text
Use web_fetch on https://example.com and tell me the page title.
```

Expected: it should identify the Example Domain page.

## Caveats

- JavaScript-heavy pages may not expose all rendered content.
- Authenticated pages need separate browser/cookie handling; use the browser/web-debug tooling instead when auth or live SPA state matters.
