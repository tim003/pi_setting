#!/usr/bin/env bash
set -euo pipefail

# Roll back from local cmux-interactive-subagents activation.
# Usage: ./scripts/rollback-cmux-interactive-subagents.sh /path/to/settings-before-cmux-interactive-subagents-YYYYMMDDTHHMMSSZ.json

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <settings-backup-json>" >&2
  exit 1
fi

backup="$1"
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
SETTINGS="$PI_DIR/settings.json"

if [[ ! -f "$backup" ]]; then
  echo "ERROR: backup not found: $backup" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
rollback_current="$PI_DIR/update-tracking/settings-before-rollback-cmux-interactive-subagents-$stamp.json"
mkdir -p "$PI_DIR/update-tracking"
if [[ -f "$SETTINGS" ]]; then
  cp "$SETTINGS" "$rollback_current"
  echo "Backed up current settings before rollback to: $rollback_current"
fi

cp "$backup" "$SETTINGS"
rm -rf "$PI_DIR/extensions/cmux-interactive-subagents"

cat <<EOF
Restored settings from:
$backup

Removed:
$PI_DIR/extensions/cmux-interactive-subagents

Note: this does not kill already-running child Pi processes or remove their cmux panes.
Generated child sessions, sidecars, system-prompt artifacts, and launch scripts may remain for inspection.
Close stale panes/processes manually if needed.

Run /reload or restart Pi, then verify the previous subagent provider is back.
EOF
