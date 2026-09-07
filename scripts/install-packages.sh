#!/usr/bin/env bash
set -euo pipefail

# Reinstall the Pi packages and local resources used by this setup.
# Review third-party package source before installing; Pi packages run with full system access.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

pi install npm:pi-claude-oauth-adapter
pi install git:github.com/obra/superpowers
pi install npm:pi-web-access
pi install git:github.com/amosblomqvist/pi-observational-memory
# Drives the real signed-in Chrome profile. Needs a manual step after install:
# /chrome onboard, then Load unpacked in chrome://extensions. See docs/OPERATIONS.md.
pi install npm:pi-chrome

mkdir -p "$PI_DIR/extensions" "$PI_DIR/skills" "$HOME/Desktop/pi-inbox"

# Subagent definitions for the local cmux provider. They live in the global agent
# dir, which the provider reads directly, so no extra package is needed.
#
# Symlinked rather than copied on purpose: each role's model lives in its own
# markdown frontmatter, so these are files that get edited and tuned, not static
# assets. Two copies meant an edit could be made in the repo and silently not be
# what pi loaded. One file, git-tracked, no deploy step.
if [ -L "$PI_DIR/agents" ]; then
	if [ "$(readlink "$PI_DIR/agents")" != "$REPO_DIR/agents" ]; then
		ln -sfn "$REPO_DIR/agents" "$PI_DIR/agents"
		echo "repointed $PI_DIR/agents -> $REPO_DIR/agents"
	fi
elif [ -d "$PI_DIR/agents" ]; then
	# Never delete a real directory that may hold agents this repo does not track.
	BACKUP="$PI_DIR/agents.replaced-by-symlink.$(date +%Y%m%d-%H%M%S)"
	mv "$PI_DIR/agents" "$BACKUP"
	ln -s "$REPO_DIR/agents" "$PI_DIR/agents"
	echo "moved the previous agents dir to $BACKUP and symlinked to $REPO_DIR/agents"
	echo "check it for agent definitions this repo does not track, then delete it"
else
	ln -s "$REPO_DIR/agents" "$PI_DIR/agents"
fi

for extension in ask-user-question host-safety-guard prompt-snippets web-fetch bash-guard browser parked-issues; do
  rm -rf "$PI_DIR/extensions/$extension"
  cp -R "$REPO_DIR/extensions/$extension" "$PI_DIR/extensions/$extension"
done

for extension in ask-user-question host-safety-guard web-fetch bash-guard browser prompt-snippets parked-issues; do
  (
    cd "$PI_DIR/extensions/$extension"
    rm -rf node_modules
    if [ "$extension" = "host-safety-guard" ]; then
      npm install
    else
      npm install --omit=dev
    fi
    if [ "$extension" = "browser" ]; then
      npx playwright-core install chromium
    fi
  )
done

# Install the local cmux subagent provider, which registers the `subagent` tool.
# Its launcher explicitly loads pi-claude-oauth-adapter in child Pi processes
# before the child-helper extension so Anthropic OAuth compatibility behavior
# remains available under --no-extensions isolation.
rm -rf "$PI_DIR/extensions/cmux-interactive-subagents"
cp -R "$REPO_DIR/extensions/cmux-interactive-subagents" "$PI_DIR/extensions/cmux-interactive-subagents"
(
  cd "$PI_DIR/extensions/cmux-interactive-subagents"
  rm -rf node_modules
  npm install --omit=dev
)

for skill in analyze-sessions pdf-reader web-debug youtube-transcript; do
  rm -rf "$PI_DIR/skills/$skill"
  cp -R "$REPO_DIR/skills/$skill" "$PI_DIR/skills/$skill"
done

cat <<'EOF'

Installed package sources, local extensions, subagent definitions, and selected skills, and ensured ~/Desktop/pi-inbox exists.
Copy settings/settings.example.json to your Pi settings, or merge its packages array manually.
Run /reload inside Pi to load changed extension code.
EOF
