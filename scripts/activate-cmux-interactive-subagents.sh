#!/usr/bin/env bash
set -euo pipefail

# Activate the local cmux-interactive-subagents provider.
# This must only run in a Pi environment with direct cmux access.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
SETTINGS="$PI_DIR/settings.json"
SRC="$REPO_DIR/extensions/cmux-interactive-subagents"
DEST="$PI_DIR/extensions/cmux-interactive-subagents"
TMP_DEST="$PI_DIR/extensions-disabled/.cmux-interactive-subagents.activate-tmp"

checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
  else
    shasum -a 256 "$1"
  fi
}

if ! command -v cmux >/dev/null 2>&1; then
  echo "ERROR: cmux is not on PATH. Start/run this from a cmux-capable Pi process." >&2
  exit 1
fi

if [[ -z "${CMUX_SOCKET_PATH:-}" ]]; then
  echo "ERROR: CMUX_SOCKET_PATH is not set. Start Pi from inside cmux." >&2
  exit 1
fi

if [[ ! -f "$SETTINGS" ]]; then
  echo "ERROR: settings file not found: $SETTINGS" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="$PI_DIR/update-tracking/settings-before-cmux-interactive-subagents-$stamp.json"
new_settings="$PI_DIR/update-tracking/settings-with-cmux-interactive-subagents-$stamp.json"
mkdir -p "$PI_DIR/update-tracking" "$PI_DIR/extensions" "$PI_DIR/extensions-disabled"
cp "$SETTINGS" "$backup"

echo "Backed up settings to: $backup"
checksum "$backup"

rm -rf "$TMP_DEST"
cp -R "$SRC" "$TMP_DEST"
(
  cd "$TMP_DEST"
  rm -rf node_modules
  npm install --omit=dev
)

node - "$SETTINGS" "$new_settings" <<'NODE'
const fs = require('fs');
const settingsPath = process.argv[2];
const outPath = process.argv[3];
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const packages = Array.isArray(settings.packages) ? settings.packages : [];
let disabledPiSubagents = 0;
let disabledHazatInteractive = 0;
settings.packages = packages.map((entry) => {
  const source = typeof entry === 'string' ? entry : entry && entry.source;
  if (source === 'npm:pi-subagents' || source === 'git:github.com/HazAT/pi-interactive-subagents') {
    const next = typeof entry === 'string' ? { source } : { ...entry };
    next.extensions = [];
    if (source === 'npm:pi-subagents') disabledPiSubagents++;
    if (source === 'git:github.com/HazAT/pi-interactive-subagents') disabledHazatInteractive++;
    return next;
  }
  return entry;
});
if (disabledPiSubagents === 0) {
  console.error('ERROR: did not find npm:pi-subagents in settings.packages; refusing to activate because duplicate subagent provider state cannot be verified. Disable existing subagent providers manually first, or add npm:pi-subagents as a disabled package entry.');
  process.exit(1);
}
console.error(`Disabled package extension resources: npm:pi-subagents=${disabledPiSubagents}, legacy HazAT/pi-interactive-subagents=${disabledHazatInteractive}`);
fs.writeFileSync(outPath, JSON.stringify(settings, null, 2) + '\n');
NODE

# Commit activation only after staging and settings generation both succeed.
cp "$new_settings" "$SETTINGS"
rm -rf "$DEST"
mv "$TMP_DEST" "$DEST"

cat <<EOF

Activated local cmux-interactive-subagents at:
$DEST

npm:pi-subagents extension resources were disabled in settings; any legacy HazAT interactive-subagents entry was disabled if present.
Run /reload or restart Pi, then smoke test:
  1. subagents_list
  2. subagent({"name":"cmux-smoke-test","agent":"delegate","task":"Say exactly: cmux custom subagent ok"})
  3. subagent_message({"name":"cmux-smoke-test","message":"Say exactly: cmux resume ok"})

Rollback:
  ./scripts/rollback-cmux-interactive-subagents.sh "$backup"
EOF
