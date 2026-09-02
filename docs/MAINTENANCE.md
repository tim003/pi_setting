# Maintenance

Update, rollback, and troubleshooting notes for this Pi setup.

## Update packages

```bash
pi update --extensions
./scripts/patch-model-verification.sh
```

Then run `/reload` inside Pi or restart Pi.

`patch-model-verification.sh` is needed because `pi update --extensions` reinstalls `npm:pi-subagents` and removes the local alias-verification patch.

## Update Pi itself

For the host macOS setup:

```bash
pi update --self
pi --version
```

If Pi was installed through a specific `nvm` Node version, make sure your shell and cmux panes use that same Node/npm environment.

## Reinstall local resources

From this repo:

```bash
./scripts/install-packages.sh
cp settings/settings.example.json "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/settings.json"
cp settings/web-search.example.json "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/web-search.json"
./scripts/patch-model-verification.sh
```

Then run `/reload`.

## Clean generated dependencies

This repo intentionally does not track extension `node_modules/`. If the checkout gets large, clean ignored generated folders:

```bash
find extensions -type d -name node_modules -prune -exec rm -rf {} +
```

Recreate them with:

```bash
./scripts/install-packages.sh
```

## Auth checks

Claude Code / Anthropic:

```bash
claude --version
claude auth login --claudeai
pi auth check --provider anthropic --model claude-haiku-4-5 --json
```

GitHub SSH:

```bash
ssh -T git@github.com
```

Codex CLI, if used:

```bash
export CODEX_HOME="$HOME/.pi/agent/codex"
codex login --device-auth
codex login status
```

Pi OpenAI/Codex provider auth is separate from the external `codex` CLI login.

## cmux subagent troubleshooting

Symptom: no child pane or subagent launch fails.

Check:

```bash
echo "$CMUX_SOCKET_PATH"
command -v cmux
```

Then inspect `~/.pi/agent/settings.json` and confirm:

```json
{ "source": "npm:pi-subagents", "extensions": [] }
```

Run:

```bash
./scripts/activate-cmux-interactive-subagents.sh
```

Then `/reload` or restart Pi.

Symptom: child completed but run reports model verification failure.

Run:

```bash
./scripts/patch-model-verification.sh
```

## cmux remote relay troubleshooting

Check listener:

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN
```

Expected: bound to the Mac Tailscale IP, not `*:4399`.

Check socket mode:

```bash
launchctl getenv CMUX_SOCKET_MODE
```

Expected, if using Cmux Remote relay:

```text
allowAll
```

Check logs:

```bash
tail -n 50 ~/.cmuxremote/log/stderr.log
```

Common symptoms:

- `socketMissing(...)`: cmux is not running.
- repeated attach/detach: relaunch cmux after setting `CMUX_SOCKET_MODE=allowAll`, then restart the relay.
- listener on `*:4399`: bind `~/.cmuxremote/relay.json` to the Mac tailnet IP.

## Rollback

Activation scripts write settings backups under:

```text
~/.pi/agent/update-tracking/
```

Rollback cmux subagent activation:

```bash
./scripts/rollback-cmux-interactive-subagents.sh ~/.pi/agent/update-tracking/settings-before-cmux-interactive-subagents-YYYYMMDDTHHMMSSZ.json
```

Manual rollback:

```bash
rm -rf ~/.pi/agent/extensions/cmux-interactive-subagents
# restore a saved settings.json if needed
# then run /reload inside Pi
```

Disable resources without uninstalling:

```bash
pi config
pi config -l
```

Remove packages only when you no longer need them:

```bash
pi remove git:github.com/amosblomqvist/pi-observational-memory
```

Keep `npm:pi-subagents` installed if using the local cmux provider, because the local provider relies on its packaged Markdown agent definitions.

## Historical notes

Historical migration and implementation notes live under `docs/archive/`. They are retained for audit/debugging, but `INSTALL.md`, `docs/OPERATIONS.md`, and this file are the canonical current docs.
