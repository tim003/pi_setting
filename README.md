# pi_setting

Shareable setup repo for Tim's macOS **Pi + cmux** coding-agent environment.

This is not a full copy of `~/.pi/agent`. It contains reproducible settings, install scripts, local extensions, selected skills, and setup notes. Runtime state and credentials stay local.

## Start here

For a fresh macOS install, follow:

- [`INSTALL.md`](INSTALL.md)

After setup, use:

- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — daily use: packages, local extensions, skills, cmux subagents, memory, browser/web tools.
- [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) — updates, cleanup, rollback, troubleshooting.
- [`docs/SECURITY.md`](docs/SECURITY.md) — credentials, host access, Tailscale/VPS, Cmux Remote risk notes.
- [`docs/PROVENANCE.md`](docs/PROVENANCE.md) — where the local extensions and skills came from, and how to port upstream fixes.

## Quick install

```bash
git clone git@github.com:tim003/pi_setting.git ~/pi_setting
cd ~/pi_setting

npm install -g @earendil-works/pi-coding-agent
./scripts/install-packages.sh

PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR"
cp settings/settings.example.json "$PI_DIR/settings.json"
cp settings/web-search.example.json "$PI_DIR/web-search.json"

pi
```

Inside Pi, run:

```text
/reload
```

For the full flow, including Claude Code auth, cmux, Tailscale/VPS checks, and optional iOS Cmux Remote access, use [`INSTALL.md`](INSTALL.md).

## What is included

### Settings

- `settings/settings.example.json`
- `settings/web-search.example.json`

### Scripts

- `scripts/install-packages.sh` — install Pi packages, local extensions, subagent definitions, selected skills, extension dependencies, and the local `pi-claude-auth` CLI-version patch.
- `scripts/patch-pi-claude-auth-cli-version.sh` — patch installed `pi-claude-auth` so normal `pi` startup derives the Claude Code billing/user-agent version from `claude --version` when `ANTHROPIC_CLI_VERSION` is unset.
- `scripts/test-pi-claude-auth-patch.sh` — regression test for the local `pi-claude-auth` patch.
- `scripts/reapply-om-coverage-gap-fix.sh` — reapply the local `pi-observational-memory` observer-coverage fix from `patches/om-observer-coverage-gap.patch` after `pi update` resets the clone. See [docs/MAINTENANCE.md](docs/MAINTENANCE.md#local-package-fixes).
- `scripts/check-youtube-transcript-deps.sh` — check transcript skill dependencies.

### Package-installed extensions and skills

Required parts of the setup, installed with `pi install ...` into `~/.pi/agent/npm` or `~/.pi/agent/git` and enabled via `settings.json`. Their source is deliberately not copied into `extensions/` — see [why](INSTALL.md#where-extensions-live-and-why).

- `npm:pi-claude-auth` — enabled extension for Claude Code-backed Anthropic auth.
- `git:github.com/obra/superpowers` — enabled extension plus Superpowers skills.
- `npm:pi-web-access` — enabled web access extension/tools.
- `git:github.com/amosblomqvist/pi-observational-memory` — enabled memory extension, off by default per session.
- `npm:pi-chrome` — drives the real signed-in Chrome profile via `chrome_*` tools. Needs a one-time manual Chrome step and per-session `/chrome authorize`.

### Subagent definitions

`agents/` holds the six Markdown agent definitions (`delegate`, `oracle`, `researcher`, `reviewer`, `scout`, `worker`) that the local cmux provider reads from `~/.pi/agent/agents/`.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the full extension/skill/tool inventory.

### Local extensions

- `extensions/ask-user-question/`
- `extensions/bash-guard/`
- `extensions/browser/`
- `extensions/cmux-interactive-subagents/`
- `extensions/host-safety-guard/`
- `extensions/parked-issues/`
- `extensions/prompt-snippets/`
- `extensions/web-fetch/`

### Local skills

- `skills/analyze-sessions/`
- `skills/pdf-reader/`
- `skills/web-debug/`
- `skills/youtube-transcript/`

## What is excluded

Do not commit or share runtime state or credentials from `~/.pi/agent`, including:

- `auth.json`
- `models-store.json`
- `sessions/`
- `npm/`, `git/`, `bin/`
- `ssh/`
- `.memory/`
- `.env`, tokens, API keys, OAuth credentials, logs, caches, databases

Extension `node_modules/` directories are also excluded. Recreate them with:

```bash
./scripts/install-packages.sh
```

## Current package setup

```bash
pi install npm:pi-claude-auth
./scripts/patch-pi-claude-auth-cli-version.sh
pi install git:github.com/obra/superpowers
pi install npm:pi-web-access
pi install git:github.com/amosblomqvist/pi-observational-memory
pi install npm:pi-chrome
```

`pi-chrome` needs a manual step that no script can do for you — see [`docs/OPERATIONS.md`](docs/OPERATIONS.md#chrome-profile-control-pi-chrome).

The active `subagent` provider is the local `extensions/cmux-interactive-subagents/` extension. It is self-contained and needs no subagent package.

## Maintenance note

This repo has its own Git remote. Commit and push from this directory, not from the parent Obsidian vault.
