#!/usr/bin/env bash
set -euo pipefail

# Start Pi with Claude Code version metadata aligned to the installed Claude CLI.
# pi-claude-auth uses ANTHROPIC_CLI_VERSION for the Claude Code user-agent and
# billing header. Its package default can lag behind Claude Code auto-updates,
# so derive the value at launch time instead of editing node_modules.
if command -v claude >/dev/null 2>&1; then
  claude_version="$(claude --version 2>/dev/null | awk '{print $1}')"
  if [[ "$claude_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    export ANTHROPIC_CLI_VERSION="$claude_version"
  else
    echo "warning: could not parse Claude Code version from: $claude_version" >&2
  fi
else
  echo "warning: claude CLI not found; using pi-claude-auth package default for ANTHROPIC_CLI_VERSION" >&2
fi

exec pi "$@"
