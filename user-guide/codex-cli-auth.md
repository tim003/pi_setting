# Codex CLI Auth

## Purpose

The `codex-exec` / `codex-exec-writer` subagents shell out to the external `codex` CLI binary. This is separate from using OpenAI/Codex provider models inside Pi.

## Current status

Verified 2026-09-01:

- `CODEX_HOME=~/.pi/agent/codex`
- `CODEX_HOME=~/.pi/agent/codex` is used by the host `codex` CLI
- auth hash survived package updates and `/reload`
- Codex smoke tests passed

## Login

From macOS Terminal:

```bash
codex login --device-auth
```

Open the printed URL in a browser, enter the one-time code, then verify:

```bash
codex login status
```

## Persistence

Host Pi should be started with:

```bash
export CODEX_HOME="$HOME/.pi/agent/codex"
```

This keeps Codex CLI credentials under the host Pi runtime directory instead of scattering them into unrelated shell profiles or project folders.

## Caveats

- Pi `/login` for OpenAI/Codex provider models is not the same as `codex login` for the CLI.
- `pi auth print-bearer-token --provider openai-codex | codex login --with-access-token` does not work.
- Do not commit Codex auth files or backups.
