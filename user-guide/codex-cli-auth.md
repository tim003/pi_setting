# Codex CLI Auth

## Purpose

The `codex-exec` / `codex-exec-writer` subagents shell out to the external `codex` CLI binary. This is separate from using OpenAI/Codex provider models inside Pi.

## Current status

Verified 2026-09-01:

- `CODEX_HOME=/root/.pi/agent/codex`
- `/root/.codex/auth.json` symlinks to `/root/.pi/agent/codex/auth.json`
- auth hash survived package updates and `/reload`
- Codex smoke tests passed

## Login

Inside the container:

```bash
codex login --device-auth
```

Open the printed URL in a browser, enter the one-time code, then verify:

```bash
codex login status
```

## Persistence

The Dockerfile sets:

```dockerfile
ENV CODEX_HOME=/root/.pi/agent/codex
```

This keeps Codex CLI credentials on the persistent `pi-agent-home` volume.

## Caveats

- Pi `/login` for OpenAI/Codex provider models is not the same as `codex login` for the CLI.
- `pi auth print-bearer-token --provider openai-codex | codex login --with-access-token` does not work.
- Do not commit Codex auth files or backups.
