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

## Update Pi itself in Docker

`pi update --self` does not persist in this container setup because it writes into the image layer. Rebuild the Docker image instead:

```bash
cd Pi/container
docker build --no-cache -t pi-sandbox -f Dockerfile.pi .
```

Use `--no-cache` so Docker does not reuse a stale global npm install layer.

## Verify after updates

Recommended checks:

```bash
pi --version
pi list
sha256sum /root/.pi/agent/codex/auth.json
readlink -f /root/.codex/auth.json
ssh -T git@github.com
```

Then run a simple subagent/Codex smoke test if those tools are part of the update.

## Known package state from 2026-09-01

- `pi-claude-auth` `0.1.3`
- `pi-subagents` `0.62.0`
- `pi-web-access` `0.27.0`
- `github.com/obra/superpowers` `b36e082`
- `github.com/HazAT/pi-interactive-subagents` installed but disabled
- `github.com/amosblomqvist/pi-observational-memory` installed

## Important caveat

Re-run `scripts/patch-model-verification.sh` after updating `pi-subagents`, because package updates reinstall the source and remove the local model-alias verification patch.
