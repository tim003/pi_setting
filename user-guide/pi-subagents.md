# Pi Subagents

## Purpose

`npm:pi-subagents` is the currently active subagent provider in this Dockerized Pi setup.

It provides the `subagent` tool used for delegation to builtin/custom agents, including async runs, reviews, and external CLI adapters such as `codex-exec` when configured.

## Current status

Active and verified 2026-09-01 at version `0.62.0`.

`git:github.com/HazAT/pi-interactive-subagents` is installed but disabled and must not be enabled at the same time because both providers register a `subagent` tool.

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
