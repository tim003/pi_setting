#!/usr/bin/env bash
set -euo pipefail

# Patch installed pi-claude-auth so its Claude Code version follows the installed
# `claude` CLI when ANTHROPIC_CLI_VERSION is unset. This keeps the package's
# user-agent and billing-header version current without requiring a special Pi
# launcher or editing node_modules by hand.
#
# Usage:
#   scripts/patch-pi-claude-auth-cli-version.sh [package-dir]
#
# Default package-dir:
#   ${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/pi-claude-auth

PKG_DIR="${1:-${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/pi-claude-auth}"
DIST_FILE="$PKG_DIR/dist/signing.js"
SRC_FILE="$PKG_DIR/src/signing.ts"

if [[ ! -f "$DIST_FILE" ]]; then
  echo "pi-claude-auth runtime file not found: $DIST_FILE" >&2
  exit 1
fi

python3 - "$DIST_FILE" "$SRC_FILE" <<'PY'
from pathlib import Path
import sys

dist = Path(sys.argv[1])
src = Path(sys.argv[2])

JS_HELPER = '''
function detectClaudeCodeVersion() {
    try {
        const output = execFileSync("claude", ["--version"], {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
        }).trim();
        const match = output.match(/^(\\d+\\.\\d+\\.\\d+)\\b/);
        return match?.[1] ?? null;
    }
    catch {
        return null;
    }
}
'''.strip()

JS_GET = '''export function getCliVersion() {
    return process.env.ANTHROPIC_CLI_VERSION ?? detectClaudeCodeVersion() ?? CC_VERSION;
}'''

TS_HELPER = '''
function detectClaudeCodeVersion(): string | null {
    try {
        const output = execFileSync("claude", ["--version"], {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
        }).trim()
        const match = output.match(/^(\\d+\\.\\d+\\.\\d+)\\b/)
        return match?.[1] ?? null
    } catch {
        return null
    }
}
'''.strip()

TS_GET = '''export function getCliVersion(): string {
    return process.env.ANTHROPIC_CLI_VERSION ?? detectClaudeCodeVersion() ?? CC_VERSION
}'''


def patch_js(path: Path) -> bool:
    text = path.read_text()
    changed = False
    if 'from "node:child_process"' not in text:
        text = 'import { execFileSync } from "node:child_process";\n' + text
        changed = True
    old = '''export function getCliVersion() {
    return process.env.ANTHROPIC_CLI_VERSION ?? CC_VERSION;
}'''
    if 'function detectClaudeCodeVersion()' not in text:
        if old not in text:
            raise SystemExit(f"could not find unpatched getCliVersion in {path}")
        text = text.replace(old, JS_HELPER + "\n" + JS_GET)
        changed = True
    elif old in text:
        text = text.replace(old, JS_GET)
        changed = True
    if changed:
        path.write_text(text)
    return changed


def patch_ts(path: Path) -> bool:
    if not path.exists():
        return False
    text = path.read_text()
    changed = False
    if 'from "node:child_process"' not in text:
        text = 'import { execFileSync } from "node:child_process"\n' + text
        changed = True
    old = '''export function getCliVersion(): string {
    return process.env.ANTHROPIC_CLI_VERSION ?? CC_VERSION
}'''
    if 'function detectClaudeCodeVersion()' not in text:
        if old not in text:
            raise SystemExit(f"could not find unpatched getCliVersion in {path}")
        text = text.replace(old, TS_HELPER + "\n" + TS_GET)
        changed = True
    elif old in text:
        text = text.replace(old, TS_GET)
        changed = True
    if changed:
        path.write_text(text)
    return changed

js_changed = patch_js(dist)
ts_changed = patch_ts(src)
print(f"patched {dist} ({'changed' if js_changed else 'already patched'})")
if src.exists():
    print(f"patched {src} ({'changed' if ts_changed else 'already patched'})")
PY
