# Package Update and Reload Workflow

## Purpose

Update Pi packages/extensions without losing credentials or confusing the current session.

## Update extensions/packages

Inside Pi or a shell with `pi` available:

```bash
pi update --extensions
```

Files update immediately on disk, but the current Pi process may keep already-loaded extension code. Run:

```text
/reload
```

or restart Pi to load changed extension code.

## Update Pi itself on host macOS

Pi is installed globally with npm under the active Node installation. To update Pi itself:

```bash
npm install -g @earendil-works/pi-coding-agent@latest
pi --version
```

Then restart Pi. Keep the old Docker wrapper/image/volume only as temporary rollback material until you are comfortable deleting it.

## Verify after updates

Recommended checks:

```bash
pi --version
pi list
shasum -a 256 ~/.pi/agent/codex/auth.json
ssh -T git@github.com
ls -ld ~/Desktop/pi-inbox
```

Then run a simple subagent/Codex smoke test if those tools are part of the update.

## Known package state from 2026-09-01

- `pi-claude-auth` `0.1.3`
- `pi-subagents` `0.62.0`
- `pi-web-access` `0.27.0`
- `github.com/obra/superpowers` `b36e082`
- `github.com/amosblomqvist/pi-observational-memory` installed
- `github.com/HazAT/pi-interactive-subagents` no longer installed by the base script
- Local cmux extension installed active: `cmux-interactive-subagents` with child `pi-claude-auth` loading for Anthropic OAuth
- Local Amos extensions installed: `ask-user-question`, `bash-guard`, `browser`, `prompt-snippets`, `web-fetch`
- Local safety extension installed: `host-safety-guard`

## Important caveats

- Run `./scripts/install-packages.sh` after changing vendored local extensions or skills in this repo.
- Run `/reload` or restart Pi after extension code changes.
- If `pi-subagents` is re-enabled for rollback, re-run `scripts/patch-model-verification.sh` after updating it because package updates reinstall the source and remove the local model-alias verification patch.
