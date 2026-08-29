#!/usr/bin/env bash
# Re-apply the pi-subagents model-verification patch.
#
# THE BUG
#   Launching a subagent with a model ALIAS (e.g. anthropic/claude-sonnet-4-6)
#   makes the run report "failed" after the child has already completed its work
#   successfully:
#
#     model_verification_failed: child reported a different model than the
#     launch candidate. Expected 'anthropic/claude-sonnet-4-6:high'
#                  but observed 'claude-sonnet-4-6-20260115'
#
#   The provider answers an alias request with the dated snapshot it resolves
#   to, and formatSubagentModelVerificationError() compares the two as strings.
#   The work is fine; only the status is wrong — but that makes run status
#   useless as a signal and forces hand-verification of every subagent result.
#
# WHY IT IS A BUG, NOT A CONFIG CHOICE
#   The same source file already defines stripTrailingDateStamp() and uses it in
#   fuzzyResolveModel() when RESOLVING a model. The identical tolerance simply
#   was not applied when VERIFYING one. There is no setting to disable the check.
#
# THE WORKAROUND THIS REPLACES
#   Pinning every agent to a dated id (claude-sonnet-4-5-20250929). That works
#   but forces older snapshots, since the newest models often expose no dated id.
#
# WHEN TO RE-RUN
#   node_modules lives in the persistent pi-agent-home volume, so the patch
#   survives container restarts and image rebuilds. It does NOT survive
#   `pi update --extensions`, which reinstalls the package. Re-run this after
#   any pi-subagents update.
#
# Usage: bash scripts/patch-model-verification.sh

set -euo pipefail

TARGET="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/pi-subagents/src/runs/shared/model-fallback.ts"

if [ ! -f "$TARGET" ]; then
  echo "ERROR: pi-subagents not found at $TARGET" >&2
  exit 1
fi

if grep -q "LOCAL PATCH" "$TARGET"; then
  echo "already patched: $TARGET"
  exit 0
fi

node - "$TARGET" <<'NODE'
const fs = require("fs");
const target = process.argv[2];
const src = fs.readFileSync(target, "utf8");

const anchor = `	const expectedEntry = availableModels.find((entry) => entry.fullId === expectedBase);
	if (expectedEntry && expectedEntry.id === observedBase) return undefined;
	return \`model_verification_failed:`;

if (!src.includes(anchor)) {
  console.error("ERROR: anchor not found — pi-subagents source has changed.");
  console.error("Inspect formatSubagentModelVerificationError() and re-derive the patch.");
  process.exit(1);
}

const replacement = `	const expectedEntry = availableModels.find((entry) => entry.fullId === expectedBase);
	if (expectedEntry && expectedEntry.id === observedBase) return undefined;
	// LOCAL PATCH: tolerate date-stamped snapshot ids. Providers answer an alias
	// request with the dated snapshot it resolves to, so an alias launch was
	// marked failed AFTER the child completed successfully. Mirrors the
	// normalization fuzzyResolveModel() already applies when resolving a model.
	// Only date-stamp/separator/case differences are tolerated, so a genuinely
	// different model family is still reported.
	const canonical = (value: string): string => {
		const idPart = value.includes("/") ? value.slice(value.indexOf("/") + 1) : value;
		return stripTrailingDateStamp(normalizeModelSegment(idPart));
	};
	if (canonical(expectedBase) === canonical(observedBase)) return undefined;
	return \`model_verification_failed:`;

fs.writeFileSync(target, src.replace(anchor, replacement));
console.log("patched:", target);
NODE

echo "done — verify with a subagent launched using an alias model id"
