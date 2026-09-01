# Pi Claude Auth

## Purpose

`npm:pi-claude-auth` provides Claude authentication support for Pi.

## Current status

Installed and verified 2026-09-01 at version `0.1.3` on host Pi. Claude Code was re-authenticated with `claude auth login --claudeai`; `pi auth check --provider anthropic --model claude-haiku-4-5 --json` returned OAuth ready and a Claude smoke test passed.

## Usage

The extension uses Claude Code credentials rather than a separate Pi browser login.

From macOS Terminal, authenticate Claude Code first:

```bash
claude auth login --claudeai
```

Then start/reload Pi. If Claude Code itself reports expired OAuth credentials, Pi will also fail until this command succeeds.

For other providers, use Pi's normal `/login` flow.

## Verify

After Claude Code login or package updates:

1. Run `/reload` or restart Pi if extension code changed.
2. Check Pi auth:

   ```bash
   pi auth check --provider anthropic --model claude-haiku-4-5 --json
   ```

   Expected:

   ```json
   {"status":"ready","provider":"anthropic","authType":"oauth"}
   ```

3. Start a small prompt using a Claude model and confirm it responds without auth errors.

## Caveats

- This is separate from Codex CLI auth and separate from GitHub SSH auth.
- Do not commit auth files or tokens.
- Host provider/session credentials live under `~/.pi/agent`, not in this repo.
- If a Claude Code update causes billing-header drift, test starting Pi with `ANTHROPIC_CLI_VERSION=$(claude --version | awk '{print $1}')`; as of the 2026-09-01 verification, direct Pi Claude prompts worked without that override after re-auth.
- cmux subagents require `pi-claude-auth` in their child Pi process too. The local cmux launcher is patched to explicitly load `~/.pi/agent/npm/node_modules/pi-claude-auth/src/index.ts` while keeping `--no-extensions` isolation for other extensions. Verified 2026-09-01: default Anthropic child launch and resume both passed after `/reload`.
