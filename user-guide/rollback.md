# Rollback Procedures

## Settings backup

A settings backup captured before the 2026-09-01 interactive/memory migration is stored locally at:

```text
~/.pi/agent/update-tracking/settings-before-interactive-memory-20260901T071922Z.json
```

Restore it with:

```bash
cp ~/.pi/agent/update-tracking/settings-before-interactive-memory-20260901T071922Z.json ~/.pi/agent/settings.json
```

Then run `/reload` or restart Pi.

## Before risky live extension changes

Create a new timestamped backup:

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ~/.pi/agent/update-tracking
backup="$HOME/.pi/agent/update-tracking/settings-before-change-$stamp.json"
cp "$HOME/.pi/agent/settings.json" "$backup"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup"
else
  shasum -a 256 "$backup"
fi
```

## Disable a package extension without uninstalling

Use Pi config UI:

```bash
pi config
```

or edit `~/.pi/agent/settings.json` so the package entry has no active extensions, for example:

```json
{ "source": "npm:pi-subagents", "extensions": [] }
```

Run `/reload` after changing settings.

## Remove a package

```bash
pi remove git:github.com/amosblomqvist/pi-observational-memory
pi remove npm:pi-subagents
```

Keep `npm:pi-subagents` installed when using the custom cmux provider; the custom provider reads its packaged Markdown definitions for familiar Pi-backed agents such as `delegate`, `worker`, `reviewer`, `scout`, `researcher`, and `oracle`. Disable its extension resources instead of removing the package. Only remove `npm:pi-subagents` if another source of agent definitions is available or you intentionally want no subagent tool.

`git:github.com/HazAT/pi-interactive-subagents` is not installed by the current base script; if it exists from an older setup, remove it with `pi remove git:github.com/HazAT/pi-interactive-subagents`.

## Remove local copied resources

Delete or rename resources under:

```text
~/.pi/agent/extensions/
~/.pi/agent/skills/
```

Then run `/reload`.

## Roll back from a custom `subagent` provider

1. Prefer the scripted rollback:

   ```bash
   ./scripts/rollback-cmux-interactive-subagents.sh /path/to/settings-before-cmux-interactive-subagents-YYYYMMDDTHHMMSSZ.json
   ```

2. Or manually restore the settings backup.
3. Disable/remove the custom local extension.
4. Re-enable `npm:pi-subagents` if needed.
5. Run `/reload`.
6. Verify:

   ```bash
   pi list
   ```

7. In Pi, verify `subagent({ action: "list" })` works again.

The scripted rollback backs up the current settings before restoring the activation snapshot. It does not kill already-running child Pi processes or close cmux panes; close stale panes/processes manually if needed.
