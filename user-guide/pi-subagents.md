# Pi Subagents

## Purpose

`npm:pi-subagents` is installed for packaged Markdown agent definitions and rollback/reference, but its extension resources are disabled. The active live `subagent` provider is the local cmux interactive subagent extension.

When enabled, `pi-subagents` provides a `subagent` tool for delegation to builtin/custom agents, including async runs, reviews, and external CLI adapters such as `codex-exec` when configured. In this host setup, the local cmux provider owns the live `subagent` tool instead.

## Current status

Installed and verified 2026-09-01 at version `0.62.0`, but extension resources are filtered/disabled in the live host Pi settings to avoid duplicate `subagent` tools.

`git:github.com/HazAT/pi-interactive-subagents` is no longer installed by the base script. Use `cmux-interactive-subagents.md` for the active provider.

## Common usage

List available agents:

```json
{ "action": "list" }
```

Run one child:

```json
{
  "agent": "reviewer",
  "task": "Review the current diff for correctness and risks."
}
```

Use workflowScript for multiple coordinated children rather than launching separate top-level workflows.

## Update caveat: model alias verification patch

`pi-subagents` `0.62.0` still false-fails some alias model runs because verification compares the launch alias with the provider's dated snapshot id.

After `pi update --extensions`, re-run:

```bash
./scripts/patch-model-verification.sh
```

from this repo. The patch is idempotent.

## Smoke tests

After updates or rollback, verify:

1. `subagent({ action: "list" })` lists expected agents.
2. A simple child returns an exact phrase.
3. If using `codex-exec`, run a tiny exact-output smoke test.

## Disable

To test a replacement `subagent` provider, disable this package's extension resources in settings, but keep the package installed for rollback.

Example package entry shape:

```json
{ "source": "npm:pi-subagents", "extensions": [] }
```

Then run `/reload`.
