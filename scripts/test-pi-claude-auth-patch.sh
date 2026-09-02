#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_SCRIPT="$REPO_DIR/scripts/patch-pi-claude-auth-cli-version.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PKG_DIR="$TMP_DIR/pi-claude-auth"
mkdir -p "$PKG_DIR/dist" "$PKG_DIR/src" "$TMP_DIR/bin"
cat > "$PKG_DIR/package.json" <<'JSON'
{"type":"module"}
JSON

cat > "$PKG_DIR/dist/signing.js" <<'JS'
export const CC_VERSION = "2.1.160";
export function getCliVersion() {
    return process.env.ANTHROPIC_CLI_VERSION ?? CC_VERSION;
}
export function buildUserAgent() {
    return `claude-cli/${getCliVersion()} (external, sdk-cli)`;
}
JS

cat > "$PKG_DIR/src/signing.ts" <<'TS'
export const CC_VERSION = "2.1.160"
export function getCliVersion(): string {
    return process.env.ANTHROPIC_CLI_VERSION ?? CC_VERSION
}
TS

cat > "$TMP_DIR/bin/claude" <<'SH'
#!/usr/bin/env bash
echo "9.8.7 (Claude Code)"
SH
chmod +x "$TMP_DIR/bin/claude"

"$PATCH_SCRIPT" "$PKG_DIR"

cd "$PKG_DIR"
PATH="$TMP_DIR/bin:$PATH" node --input-type=module <<'JS'
import { getCliVersion, buildUserAgent } from './dist/signing.js';
delete process.env.ANTHROPIC_CLI_VERSION;
if (getCliVersion() !== '9.8.7') {
  throw new Error(`expected auto-detected 9.8.7, got ${getCliVersion()}`);
}
if (!buildUserAgent().startsWith('claude-cli/9.8.7 ')) {
  throw new Error(`user-agent did not use auto-detected version: ${buildUserAgent()}`);
}
process.env.ANTHROPIC_CLI_VERSION = '1.2.3';
if (getCliVersion() !== '1.2.3') {
  throw new Error(`env override should win, got ${getCliVersion()}`);
}
JS

if ! rg -q 'detectClaudeCodeVersion' "$PKG_DIR/src/signing.ts"; then
  echo "src/signing.ts was not patched" >&2
  exit 1
fi

echo "pi-claude-auth CLI version patch test passed"
