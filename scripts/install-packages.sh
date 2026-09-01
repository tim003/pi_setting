#!/usr/bin/env bash
set -euo pipefail

# Reinstall the Pi packages and local resources used by this setup.
# Review third-party package source before installing; Pi packages run with full system access.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

pi install npm:pi-claude-auth
pi install git:github.com/obra/superpowers
# Kept for skills/reference, but disable its extension in settings.example.json
# before using HazAT's interactive subagents to avoid duplicate `subagent` tools.
pi install npm:pi-subagents
pi install npm:pi-web-access
pi install git:github.com/HazAT/pi-interactive-subagents
pi install git:github.com/amosblomqvist/pi-observational-memory

mkdir -p "$PI_DIR/extensions" "$PI_DIR/skills"
rm -rf "$PI_DIR/extensions/web-fetch"
cp -R "$REPO_DIR/extensions/web-fetch" "$PI_DIR/extensions/web-fetch"
(
  cd "$PI_DIR/extensions/web-fetch"
  npm install --omit=dev
)

for skill in analyze-sessions pdf-reader web-debug youtube-transcript; do
  rm -rf "$PI_DIR/skills/$skill"
  cp -R "$REPO_DIR/skills/$skill" "$PI_DIR/skills/$skill"
done

cat <<'EOF'

Installed package sources plus local web-fetch and selected skills.
Copy settings/settings.example.json to your Pi settings or merge its package filters manually.
Run /reload inside Pi to load changed extension code.
EOF
