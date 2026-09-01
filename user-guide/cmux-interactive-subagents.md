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

It is active in host Pi at:

```text
~/.pi/agent/extensions/cmux-interactive-subagents/
```

`npm:pi-subagents` remains installed but extension-disabled to avoid duplicate `subagent` tools; the local cmux extension is the active subagent provider. `git:github.com/HazAT/pi-interactive-subagents` is no longer installed by the base script.

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

## Install safely

From `pi_setting`:

```bash
./scripts/install-packages.sh
```

The script installs this extension as the active host-Pi subagent provider:

```text
${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions/cmux-interactive-subagents/
```

It also installs `npm:pi-subagents` for packaged Markdown agent definitions, but `settings.example.json` disables that package's extension resources so only the local cmux provider registers `subagent`.

To manually install the local provider:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR/extensions"
rm -rf "$PI_DIR/extensions/cmux-interactive-subagents"
cp -R extensions/cmux-interactive-subagents "$PI_DIR/extensions/cmux-interactive-subagents"
(cd "$PI_DIR/extensions/cmux-interactive-subagents" && npm install --omit=dev)
```

The launcher explicitly loads `~/.pi/agent/npm/node_modules/pi-claude-auth/src/index.ts` into child Pi processes before `child-helper.ts`. Keep `pi-claude-auth` installed and re-run `/reload` after changes so Anthropic child subagents use Claude Code OAuth correctly despite `--no-extensions` isolation.

## Test helpers

```bash
cd extensions/cmux-interactive-subagents
npm test
node --import tsx -e "await import('./index.ts'); await import('./child-helper.ts'); console.log('entrypoint imports ok')"
```

## Live rollout checklist

For normal host Pi installs, use `./scripts/install-packages.sh` and copy/merge `settings/settings.example.json` so `npm:pi-subagents` is extension-disabled. The older activation script remains as a guarded repair/rollback-era helper for existing installs; the base install path no longer requires a separate cmux activation step.

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
