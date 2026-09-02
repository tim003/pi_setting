# Operations

Daily-use guide for the Pi setup installed from this repository.

## Core commands

```bash
pi --version
pi list
pi --list-models
```

Inside Pi:

```text
/reload          # reload extensions, skills, prompts, settings-derived resources
/model           # choose model
/om:status       # observational-memory status
/om on           # enable observational memory for this session
/om off          # disable observational memory
/browser on      # enable browser tools when needed
/browser off     # disable browser tools
```

## Installed packages

Configured in `settings/settings.example.json` and installed by `scripts/install-packages.sh`:

- `npm:pi-claude-auth` — Anthropic auth via Claude Code OAuth credentials.
- `git:github.com/obra/superpowers` — process extension plus Superpowers skills.
- `npm:pi-web-access` — web access extension/tools.
- `git:github.com/amosblomqvist/pi-observational-memory` — memory extension; off by default.

## Complete extension inventory

Package-installed extensions are required parts of this setup. They load from `~/.pi/agent/npm` or `~/.pi/agent/git`, so their source is intentionally not copied into this repo's `extensions/` directory — see [why](../INSTALL.md#where-extensions-live-and-why).

| Source | Extension status | Purpose |
|---|---|---|
| `npm:pi-claude-auth` | enabled | Seeds Anthropic auth from Claude Code credentials. |
| `git:github.com/obra/superpowers` | enabled | Loads Superpowers skill behavior and commands. |
| `npm:pi-web-access` | enabled | Provides `web_search`, `fetch_content`, `source_check`, and `get_search_content` tooling. |
| `git:github.com/amosblomqvist/pi-observational-memory` | enabled | Provides `/om` observational-memory commands and workers. |

Local extensions copied to `~/.pi/agent/extensions/` by `scripts/install-packages.sh`:

| Extension | Purpose |
|---|---|
| `ask-user-question` | Structured interactive questions for agents. |
| `bash-guard` | Command risk guard. |
| `browser` | Playwright browser tools; opt in with `/browser on`. |
| `cmux-interactive-subagents` | Active modified cmux interactive subagent provider. |
| `host-safety-guard` | Blocks risky host paths; allows safe image/screenshot reads from `~/Desktop/pi-inbox`. |
| `prompt-snippets` | Temporary prompt snippet toggles. |
| `web-fetch` | Registers the `web_fetch` URL-to-Markdown tool. |

Every extension tracked in this repo is installed by `scripts/install-packages.sh`. There are no unused or legacy extensions.

## Guard defaults

Use the guard extensions in low-friction mode unless you deliberately want stricter prompts:

- `host-safety-guard` defaults to `high-only`. It blocks high-risk credential/secret paths and auto-allows medium-risk Desktop prompts unless strict mode is enabled. Use `/host-guard` to inspect, `/host-guard high-only` for default behavior, or `/host-guard strict` for more prompts.
- `bash-guard` defaults to high-only via `PI_BASH_GUARD_LEVEL`. Medium-risk commands, including routine git commands, are auto-allowed; only high-risk commands prompt. Set `PI_BASH_GUARD_LEVEL=strict` to prompt on medium-risk commands too. Run `/bash-guard` to disable interactive prompting for a session; catastrophic patterns remain hard-blocked in all modes.

## Complete skills and prompts inventory

Package-installed skills:

- From `git:github.com/obra/superpowers`:
  - `using-superpowers`
  - `brainstorming`
  - `systematic-debugging`
  - `test-driven-development`
  - `using-git-worktrees`
  - `writing-plans`
  - `executing-plans`
  - `dispatching-parallel-agents`
  - `subagent-driven-development`
  - `requesting-code-review`
  - `receiving-code-review`
  - `verification-before-completion`
  - `finishing-a-development-branch`
  - `writing-skills`

Package-installed web tools from `npm:pi-web-access`:

- `web_search`
- `fetch_content`
- `source_check`
- `get_search_content`

Local web/fetch tool from this repo:

- `web_fetch`

Local skills copied to `~/.pi/agent/skills/`:

- `analyze-sessions` — inspect past Pi session cost, prompts, and transcripts.
- `pdf-reader` — extract/search/render PDFs.
- `web-debug` — debug live frontend behavior with browser tools.
- `youtube-transcript` — fetch YouTube transcripts as JSON.

## cmux interactive subagents

The live subagent provider is the local extension:

```text
~/.pi/agent/extensions/cmux-interactive-subagents/
```

Requirements:

- Start Pi from inside cmux when using interactive subagents.
- `CMUX_SOCKET_PATH` must be set.
- `~/.pi/agent/agents/` must contain the six agent definitions; without them `subagents_list` is empty.
- Keep `pi-claude-auth` installed; the local child launcher explicitly loads it so Anthropic child Pi processes inherit Claude Code auth while other extensions remain isolated.

Repair by re-running the installer, which recopies the extension and agent definitions:

```bash
./scripts/install-packages.sh
```

Available agents (`delegate`, `oracle`, `researcher`, `reviewer`, `scout`, `worker`) come from `~/.pi/agent/agents/`. Add a project-local override in `<project>/.pi/agents/`, and set model/thinking per agent under `subagents.agentOverrides` in `settings.json`.

Smoke tests inside Pi:

```text
subagents_list
```

Then launch a delegate named `cmux-smoke-test` with task:

```text
Say exactly: cmux custom subagent ok
```

Resume it with:

```text
Say exactly: cmux resume ok
```

## Observational memory

Installed from `git:github.com/amosblomqvist/pi-observational-memory` and gated off per session.

```text
/om:status
/om on
/om off
```

It writes `.memory/<sessionId>/` under the current project. Add `.memory/` to that project’s `.gitignore` before enabling it.

Default models in this setup:

- observer: `anthropic/claude-haiku-4-5`, low thinking
- consolidator: `anthropic/claude-sonnet-4-6`, medium thinking

## Browser and web tools

Use `web_fetch` for clean Markdown extraction from simple public URLs.

Use `/browser on` plus browser tools when you need live frontend state: DOM, network, console, local storage, forms, screenshots, or authenticated browser sessions.

Browser dependencies are installed by `scripts/install-packages.sh`. If Chromium is missing:

```bash
cd ~/.pi/agent/extensions/browser
npx playwright-core install chromium
```

## Prompt snippets

The `prompt-snippets` extension provides temporary prompt toggles for recurring behaviors such as asking questions, delegating exploration, verifying assumptions, and orchestrator mode. Use its registered Pi commands after `/reload`.

## Session analysis

Use the `analyze-sessions` skill when asking Pi about past sessions, costs, prompts, or transcript search. It reads local session files under `~/.pi/agent/sessions/`; do not commit those files.
