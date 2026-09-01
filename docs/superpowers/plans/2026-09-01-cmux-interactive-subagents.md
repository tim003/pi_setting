# cmux Interactive Subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and live-install a small cmux-only Pi interactive subagent extension with simplified spawn/message APIs and child auto-exit.

**Architecture:** The extension is split into pure helpers (`core.ts`, `agents.ts`, `session.ts`) with node:test coverage, a runtime entrypoint (`index.ts`) registering parent tools, a child helper (`child-helper.ts`) registering `ask_question` and auto-exit hooks, and a small `cmux.ts` shell wrapper. Runtime smoke testing is gated by actual `cmux` availability.

**Tech Stack:** Pi TypeScript extensions via jiti, Node.js built-ins, `typebox`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, Node `node:test` for pure helper tests.

**Spec:** `docs/superpowers/specs/2026-09-01-cmux-interactive-subagents-design.md`

## Global Constraints

- V1 supports Pi-backed child agents only.
- The parent/orchestrator must provide a required unique `name` for each child.
- Register only parent tools `subagent`, `subagent_message`, and `subagents_list`.
- Register child-only `ask_question`; do not expose `subagent_done`.
- Assume direct access to `cmux` and `CMUX_SOCKET_PATH`; Docker-to-host bridging is out of scope.
- Do not run this provider concurrently with `npm:pi-subagents` because both register `subagent`.
- Use backup and rollback before live activation.

---

### Task 1: Pure core helpers and tests

**Files:**
- Create: `extensions/cmux-interactive-subagents/src/core.ts`
- Create: `extensions/cmux-interactive-subagents/test/core.test.mjs`
- Create: `extensions/cmux-interactive-subagents/package.json`

**Interfaces:**
- Produces: `sanitizeName(name: string): string`, `validateLaunch(input, knownNames)`, `chooseMessageMode(name, registry)`, `shouldAutoExitOnAgentEnd(state, messages)`.

- [x] Write failing node:test tests for name validation, duplicate rejection, message mode routing, and auto-exit suppression.
- [x] Run tests and verify failure because implementation files do not exist.
- [x] Implement minimal helpers.
- [x] Run tests and verify pass.

### Task 2: Agent discovery

**Files:**
- Create: `extensions/cmux-interactive-subagents/src/agents.ts`
- Create: `extensions/cmux-interactive-subagents/test/agents.test.mjs`

**Interfaces:**
- Produces: `discoverAgents(cwd: string, agentDir: string): AgentDefinition[]`.

- [x] Write failing tests with temp global/project agent directories showing project overrides global.
- [x] Implement Markdown/frontmatter parser for fields `name`, `description`, `model`, `thinking`, `tools`, `autoExit`.
- [x] Run tests and verify pass.

### Task 3: Session/result helpers

**Files:**
- Create: `extensions/cmux-interactive-subagents/src/session.ts`
- Create: `extensions/cmux-interactive-subagents/test/session.test.mjs`

**Interfaces:**
- Produces: `makeChildSessionPath(baseDir, name)`, `readFinalAssistantMessage(sessionFile)`, `writeLoadout(sessionFile, loadout)`, `readLoadout(sessionFile)`.

- [x] Write failing tests for safe session filenames and final assistant text extraction.
- [x] Implement minimal session helpers.
- [x] Run tests and verify pass.

### Task 4: Runtime extension and child helper

**Files:**
- Create: `extensions/cmux-interactive-subagents/index.ts`
- Create: `extensions/cmux-interactive-subagents/child-helper.ts`
- Create: `extensions/cmux-interactive-subagents/src/cmux.ts`
- Modify: `user-guide/cmux-interactive-subagents.md`

**Interfaces:**
- Parent registers `subagent`, `subagent_message`, `subagents_list`.
- Child helper registers `ask_question` and auto-exit hooks.

- [x] Wire tool schemas and validation.
- [x] Implement cmux availability checks and clear unavailable result.
- [x] Launch child Pi session with `-e child-helper.ts`, session file, model/cwd/system-prompt options, and environment variables.
- [x] Implement live steer/resume command sending through cmux.
- [x] Implement watcher loop for `.ask` and `.exit` sidecars.
- [x] Update user guide with final install and smoke-test commands.

### Task 5: Live install with rollback

**Files:**
- Modify: `/root/.pi/agent/settings.json` only after backup.
- Copy: `extensions/cmux-interactive-subagents/` to `/root/.pi/agent/extensions/cmux-interactive-subagents/`.

- [x] Add activation script that backs up `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/settings.json` with timestamp.
- [x] Stage local extension under `extensions-disabled/` by default to avoid duplicate providers.
- [x] Add activation script that disables `npm:pi-subagents` and HazAT interactive-subagents extension resources before moving the custom extension into auto-discovery.
- [ ] Run `/reload` or ask user to reload from a cmux-capable Pi process.
- [ ] Smoke test when `cmux` is available.
- [ ] If smoke test fails, restore backup and re-enable `npm:pi-subagents` using the rollback script.
