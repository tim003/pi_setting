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

- `scripts/install-packages.sh` — install Pi packages, local extensions, subagent definitions, selected skills, and extension dependencies.
- `scripts/reapply-om-local-fixes.sh` — reapply the local `pi-observational-memory` fixes (observer coverage spans, NUL bytes in worker argv) from `patches/` after `pi update` resets the clone. See [docs/MAINTENANCE.md](docs/MAINTENANCE.md#local-package-fixes).
- `scripts/check-youtube-transcript-deps.sh` — check transcript skill dependencies.

### Package-installed extensions and skills

Required parts of the setup, installed with `pi install ...` into `~/.pi/agent/npm` or `~/.pi/agent/git` and enabled via `settings.json`. Their source is deliberately not copied into `extensions/` — see [why](INSTALL.md#where-extensions-live-and-why).

- `npm:pi-claude-oauth-adapter` — enabled compatibility adapter for Pi's built-in Anthropic OAuth / Claude Pro/Max sessions.
- `git:github.com/obra/superpowers` — enabled extension plus Superpowers skills.
- `npm:pi-web-access` — enabled web access extension/tools.
- `git:github.com/amosblomqvist/pi-observational-memory` — enabled memory extension, off by default per session.
- `npm:pi-chrome` — drives the real signed-in Chrome profile via `chrome_*` tools. Needs a one-time manual Chrome step and per-session `/chrome authorize`.

### Subagent definitions

`agents/` holds the six Markdown agent definitions (`delegate`, `oracle`, `researcher`, `reviewer`, `scout`, `worker`) that the local cmux provider reads from `~/.pi/agent/agents/`, which is a symlink to this directory. Each file carries its own `model:` and `thinking:` in frontmatter, so editing the file here changes what the role runs on immediately — no deploy step, though a running session needs `/reload`. See [docs/OPERATIONS.md](docs/OPERATIONS.md#which-model-a-role-runs-on).

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the full extension/skill/tool inventory.

### Local extensions

- `extensions/ask-user-question/`
- `extensions/bash-guard/` — command risk guard; `/bash-guard trust` grants a project a standing exemption (see [docs/OPERATIONS.md](docs/OPERATIONS.md#trusted-projects))
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
pi install npm:pi-claude-oauth-adapter
pi install git:github.com/obra/superpowers
pi install npm:pi-web-access
pi install git:github.com/amosblomqvist/pi-observational-memory
pi install npm:pi-chrome
```

`pi-chrome` needs a manual step that no script can do for you — see [`docs/OPERATIONS.md`](docs/OPERATIONS.md#chrome-profile-control-pi-chrome).

The active `subagent` provider is the local `extensions/cmux-interactive-subagents/` extension. It is self-contained and needs no subagent package. Children run in background cmux tabs that close themselves when done; `/fleet` brings one forward — see [`docs/OPERATIONS.md`](docs/OPERATIONS.md#rotating-a-child-into-view-fleet).

## Maintenance note

This repo has its own Git remote. Commit and push from this directory, not from the parent Obsidian vault.
