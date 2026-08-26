# pi_setting

A curated, shareable backup of my Pi coding-agent setup.

This repository is intentionally **not** a full copy of `~/.pi/agent`. GitHub is used here for reproducible configuration and setup notes, not as a database for Pi runtime state.

## What's included

- Sanitized example settings:
  - `settings/settings.example.json`
  - `settings/web-search.example.json`
- Reinstall script for Pi packages:
  - `scripts/install-packages.sh`
- Notes on what should and should not be committed.

## What's intentionally excluded

Do not commit these from `~/.pi/agent`:

- `auth.json` — provider login/auth data.
- `models-store.json` — runtime provider/model cache.
- `sessions/` — conversation history.
- `npm/`, `git/`, `bin/` — installed/generated package directories.
- `.env`, tokens, API keys, credentials, logs, caches, databases.

## Current package setup

This setup currently installs:

```bash
pi install npm:pi-claude-auth
pi install git:github.com/obra/superpowers
pi install npm:pi-subagents
pi install npm:pi-web-access
```

Or run:

```bash
./scripts/install-packages.sh
```

## Restoring settings

Review the examples first, then copy them into your Pi config directory if appropriate:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR"
cp settings/settings.example.json "$PI_DIR/settings.json"
cp settings/web-search.example.json "$PI_DIR/web-search.json"
```

Then authenticate locally with your own accounts/keys, for example by running Pi and using `/login`.

## Updating

Update installed Pi packages with:

```bash
pi update --extensions
```

Update Pi itself with:

```bash
pi update --self
```
