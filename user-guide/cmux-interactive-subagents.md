# cmux Interactive Subagents

## Purpose

Operational guide for the small custom interactive subagent extension for Pi sessions that have direct access to `cmux` and `CMUX_SOCKET_PATH`.

This is implemented as an independent extension, not a fork of HazAT or Amos. It reuses the best ideas from both:

- cmux-oriented process/pane control from the upstream interactive-subagents design.
- Smaller agent-facing schema.
- One `subagent_message` tool for both live steering and finished-session resume.
- No model-called `subagent_done` tool.
- Auto-exit when the child agent stops generating, unless it is waiting for a parent answer or its own child subagents.

## Current status

Implemented as a local vendored extension:

```text
extensions/cmux-interactive-subagents/
```

It is safe to copy/install, but only enable it in a Pi process with direct access to `cmux` and `CMUX_SOCKET_PATH`.

Current direction: migrate Pi to the macOS host and activate this there. The installed `git:github.com/HazAT/pi-interactive-subagents` package remains disabled; the old Dockerized setup could not see the host macOS `cmux` socket or command.

## V1 scope

Pi-backed child agents only. This still allows Claude, Codex/OpenAI, or other providers as Pi models via `pi --model ...`; it does not launch the external `claude` or `codex` CLI binaries directly.

Parent tools:

- `subagent`
- `subagent_message`
- `subagents_list`

Child-only tool:

- `ask_question`

## `subagent` schema

V1 schema:

```json
{
  "name": "docs-auditor",
  "agent": "researcher",
  "task": "Check the Pi docs for stale extension instructions.",
  "model": "optional-model-override",
  "cwd": "/optional/working/directory"
}
```

Required fields:

- `name`
- `agent`
- `task`

Optional fields:

- `model`
- `cwd`

## Who chooses the subagent name?

The parent/orchestrator agent chooses the name at launch time. The extension enforces that the name is present, safe, displayable, and unique within the parent session.

Use stable lane-style names because `subagent_message` targets by exact name.

Recommended pattern:

```text
<domain>-<role>
```

Examples:

- `docs-auditor`
- `cmux-smoke-test`
- `settings-reviewer`
- `youtube-transcript-check`
- `implementation-scout`
- `rollback-verifier`

For parallel workers:

- `docs-auditor-a`
- `docs-auditor-b`
- `repo-scout-1`
- `repo-scout-2`

## `subagent_message` behavior

`subagent_message` should use the same schema for both live steering and resuming a finished session:

```json
{
  "name": "docs-auditor",
  "message": "Now also check the nested pi_setting README."
}
```

Rules:

- If `name` matches a running subagent, steer the live child session.
- If `name` matches a known finished subagent, resume that session with the message.
- If `name` is unknown, return a clear error.
- Do not poll logs or sleep waiting for results; the extension should deliver the result back to the parent when available.

## Auto-exit behavior

A child session should close automatically after Pi reports `agent_settled` when all are true:

- auto-exit is enabled for the child;
- the child is not waiting for a parent answer from `ask_question`;
- the child has no running child subagents of its own;
- the last assistant turn did not end as an abort.

The child's final assistant message is the result returned to the parent.

## Install / stage safely

From `pi_setting`:

```bash
./scripts/install-packages.sh
```

The script stages this extension outside auto-discovery:

```text
${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions-disabled/cmux-interactive-subagents/
```

This avoids duplicate `subagent` tools while `npm:pi-subagents` is still active.

To manually stage:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR/extensions-disabled"
rm -rf "$PI_DIR/extensions-disabled/cmux-interactive-subagents"
cp -R extensions/cmux-interactive-subagents "$PI_DIR/extensions-disabled/cmux-interactive-subagents"
(cd "$PI_DIR/extensions-disabled/cmux-interactive-subagents" && npm install --omit=dev)
```

To activate, move/copy it to `$PI_DIR/extensions/cmux-interactive-subagents` only after disabling `npm:pi-subagents` and verifying cmux availability.

## Test helpers

```bash
cd extensions/cmux-interactive-subagents
npm test
node --import tsx -e "await import('./index.ts'); await import('./child-helper.ts'); console.log('entrypoint imports ok')"
```

## Live rollout checklist

Use the activation script from a Pi environment with direct cmux access:

```bash
./scripts/activate-cmux-interactive-subagents.sh
```

The script:

1. Fails closed unless `cmux` is on `PATH` and `CMUX_SOCKET_PATH` is set.
2. Backs up `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/settings.json` under `update-tracking/`.
3. Stages and then moves the local extension into `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions/cmux-interactive-subagents/`.
4. Runs `npm install --omit=dev` in the live extension directory.
5. Disables `npm:pi-subagents` and HazAT interactive-subagents extension resources in settings to avoid duplicate `subagent` tools.

Then run `/reload` or restart Pi.

Smoke test:

1. `subagents_list`
2. `subagent({"name":"cmux-smoke-test","agent":"delegate","task":"Say exactly: cmux custom subagent ok"})`
3. Wait for auto-exit result.
4. `subagent_message({"name":"cmux-smoke-test","message":"Say exactly: cmux resume ok"})`
5. Wait for resumed auto-exit result.

## Rollback

Use the backup path printed by the activation script:

```bash
./scripts/rollback-cmux-interactive-subagents.sh ${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/update-tracking/settings-before-cmux-interactive-subagents-YYYYMMDDTHHMMSSZ.json
```

Then run `/reload` or restart Pi.

See also [Rollback procedures](rollback.md).
