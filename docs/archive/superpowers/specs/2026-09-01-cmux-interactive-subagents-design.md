# cmux Interactive Subagents Design

## Goal

Build a small local Pi extension that provides cmux-backed interactive subagents with a reduced agent-facing API: `subagent`, `subagent_message`, and `subagents_list`.

## Scope

V1 supports Pi-backed child agents only. A child may use any Pi model/provider, including Claude or OpenAI/Codex provider models, but v1 does not launch external `claude` or `codex` CLI binaries directly.

The extension assumes the Pi process has direct access to:

- `cmux` on `PATH`
- `CMUX_SOCKET_PATH` in the environment

The Docker-to-host cmux bridge is out of scope.

## Tool API

### `subagent`

Required fields:

- `name: string` — stable display/lookup name, chosen by the parent/orchestrator.
- `agent: string` — configured agent definition name.
- `task: string` — initial task.

Optional fields:

- `model: string` — child model override.
- `cwd: string` — child working directory.

Names must be unique within the parent session. If a name is already known, callers should use `subagent_message` instead of launching again.

### `subagent_message`

Required fields:

- `name: string`
- `message: string`

If the named child is running, send a live steer message. If the named child has finished, resume its session with the message. Unknown names return a clear tool error.

### `subagents_list`

Lists discovered agent definitions and known child sessions.

## Naming

The parent/orchestrator chooses names. Recommended convention:

```text
<domain>-<role>
```

Examples: `docs-auditor`, `settings-reviewer`, `rollback-verifier`, `repo-scout-1`.

## Child helper

Every Pi child is launched with a local helper extension. The helper:

- registers child-only `ask_question`;
- writes an `.ask` sidecar for parent pickup;
- suppresses auto-exit while waiting for an answer;
- auto-exits on `agent_settled` when not awaiting an answer and no nested child work is running;
- writes a `.exit` sidecar for error/clean completion when useful.

No `subagent_done` tool is exposed.

## Agent discovery

V1 discovers Markdown agent definitions from:

- project-local `.pi/agents/`
- global `~/.pi/agent/agents/`

Project-local agents override global agents with the same name. V1 keeps the parser intentionally small: frontmatter fields used by this extension are `name`, `description`, `model`, `thinking`, `tools`, and `autoExit`. Body text becomes the child system prompt.

## Runtime state

The parent extension keeps in-memory state for the current parent session and stores per-child metadata beside the child session file so finished sessions can be resumed by name during the same parent process.

## Live safety

Because this extension registers `subagent`, it must not be active at the same time as `npm:pi-subagents` or HazAT interactive subagents.

Rollout requires:

1. Back up `/root/.pi/agent/settings.json`.
2. Copy/install this local extension.
3. Disable `npm:pi-subagents` extension resources.
4. Run `/reload` or restart Pi.
5. Smoke test `subagents_list`, `subagent`, auto-exit, and `subagent_message` resume.
6. Restore backup on failure.
