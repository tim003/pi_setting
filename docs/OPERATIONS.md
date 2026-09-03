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
- `npm:pi-chrome` — Chrome profile control; locked until authorized per session.

## Complete extension inventory

Package-installed extensions are required parts of this setup. They load from `~/.pi/agent/npm` or `~/.pi/agent/git`, so their source is intentionally not copied into this repo's `extensions/` directory — see [why](../INSTALL.md#where-extensions-live-and-why).

| Source | Extension status | Purpose |
|---|---|---|
| `npm:pi-claude-auth` | enabled | Seeds Anthropic auth from Claude Code credentials. |
| `git:github.com/obra/superpowers` | enabled | Loads Superpowers skill behavior and commands. |
| `npm:pi-web-access` | enabled | Provides `web_search`, `fetch_content`, `source_check`, and `get_search_content` tooling. |
| `git:github.com/amosblomqvist/pi-observational-memory` | enabled | Provides `/om` observational-memory commands and workers. |
| `npm:pi-chrome` | enabled, but locked | Provides `chrome_*` tools driving the real Chrome profile. Inert until `/chrome authorize`. |

Local extensions copied to `~/.pi/agent/extensions/` by `scripts/install-packages.sh`:

| Extension | Purpose |
|---|---|
| `ask-user-question` | Structured interactive questions for agents. |
| `bash-guard` | Command risk guard. |
| `browser` | Playwright browser tools; opt in with `/browser on`. |
| `cmux-interactive-subagents` | Active modified cmux interactive subagent provider. |
| `host-safety-guard` | Asks before risky host paths; allows safe image/screenshot reads from `~/Desktop/pi-inbox`. |
| `parked-issues` | Captures side suggestions for later instead of derailing the current task; `/parked` to triage. |
| `prompt-snippets` | Temporary prompt snippet toggles. |
| `web-fetch` | Registers the `web_fetch` URL-to-Markdown tool. |

Every extension tracked in this repo is installed by `scripts/install-packages.sh`. There are no unused or legacy extensions.

## Guard defaults

Use the guard extensions in low-friction mode unless you deliberately want stricter prompts:

- `host-safety-guard` defaults to `high-only`. It **prompts** for high-risk credential/secret paths and auto-allows medium-risk Desktop access unless strict mode is enabled. Use `/host-guard` to inspect, `/host-guard high-only` for default behavior, or `/host-guard strict` for more prompts.

  `/host-guard off` (or `pi --host-guard-disabled`, or `PI_HOST_GUARD_LEVEL=off`) stops the routine prompting when you are diagnosing SSH or cloud config. It is **not** a blanket allow — a secrets floor still applies, because a leaked credential cannot be unwritten from the transcript. While off, a red `⚠ HOST GUARD OFF` badge stays on the status line.

  | Released by `off` | Still prompts |
  | --- | --- |
  | `~/.ssh/config`, `~/.ssh/config.d/*` | private keys (`id_ed25519`, `id_rsa`, `pi_deploy`, …) |
  | `~/.ssh/known_hosts`, `authorized_keys` | `~/Library/Keychains/*` |
  | `~/.ssh/*.pub` | `~/.secrets/*`, `~/.aws/credentials` |
  | `~/.aws/config`, `~/.gnupg/*.conf` | 1Password application data |
  | Desktop / `pi-inbox` medium-risk reads | `~/.kube/config` (embeds bearer tokens) |

  The list is an allowlist, so an unfamiliar file appearing in a protected directory keeps prompting rather than slipping through. A secret-looking filename overrides it too: `~/.ssh/private-key.pub` stays guarded. For bash, a command is released only when *every* protected path it names is releasable — `cat ~/.ssh/config ~/.ssh/id_rsa` still prompts.

  High-risk findings ask rather than refuse, because it is your own machine and you are there to judge. Two properties are preserved regardless:

  - **It fails closed.** With no UI (headless `pi -p`, or a context that cannot prompt) there is no way to approve, so the call is refused. Denying also refuses.
  - **Approval has a persistent cost.** When approval would put file contents or command output into the session, the prompt says so explicitly: the data lands in the session `.jsonl` and may be copied into `.memory/`, and it stays there even if you revoke access afterwards. Prefer metadata (`ls -l`, `stat`) over reading secret files outright.

  Approvals are remembered per path for the rest of the session; `/host-guard <mode>` clears them.
- `bash-guard` defaults to high-only via `PI_BASH_GUARD_LEVEL`. Medium-risk commands, including routine git commands, are auto-allowed; only high-risk commands prompt. Set `PI_BASH_GUARD_LEVEL=strict` to prompt on medium-risk commands too. Run `/bash-guard` to disable interactive prompting for a session; catastrophic patterns remain hard-blocked in all modes.

  **Patterns match shell structure, not argument text.** Quoted spans, comments and heredoc bodies are masked before matching, so searching for a destructive pattern or describing one in a commit message does not trip the guard. Command substitutions inside double quotes stay live because they execute, and an unterminated quote is left unmasked rather than assumed inert.

### Trusted projects

Every `rm` is high-risk regardless of target, so routine work in one project used to prompt endlessly. A project can now carry a standing grant.

| command | effect |
| --- | --- |
| `/bash-guard trust` | Trust the nearest git root above the cwd |
| `/bash-guard untrust` | Revoke it |
| `/bash-guard trusted` | List all grants |

The Run/Abort prompt also offers **Run, and trust this project**, but only when a grant would actually have released that command — the option never promises quiet it cannot deliver. A `⛿ project trusted` badge shows while a grant applies.

Grants live in `~/.pi/agent/bash-guard-trust.json`, deliberately outside any repo: a grant stored in a project would travel with it, so cloning a repo would import its own permission to delete your files. Because the store is in the agent directory, subagents read it with no plumbing — which is the point, since they have no UI to prompt in.

**Trust follows the paths a command touches, not the directory it runs from.** A command is released only when it names at least one path and *every* path resolves inside a trusted root. Consequences worth knowing:

- Symlinks are resolved before the check, so a link inside the project pointing at `$HOME` cannot launder trust.
- Anything unresolvable — `$BUILD_DIR`, a command substitution — counts as outside and still prompts. A guard that guesses is not a guard.
- One outside target spoils the whole command: `rm -rf build /etc/hosts` prompts.

Never released by a grant, however trusted the project:

| category | examples |
| --- | --- |
| system-critical | `sudo`, `mkfs`, `wipefs`, `diskutil erase`, `dd of=/dev/…`, partition tools, power ops, pipe-to-shell |
| git history | `push --force`, `reset --hard`, `reflog expire`, `gc --prune`, `filter-branch` |
| irreplaceable targets | the trusted root itself, any `.git` directory |

**The residual risk, stated plainly:** inside a trusted project an agent can delete any file without asking, including uncommitted work. Committed history survives; unstaged edits do not. Grant per project, not to a directory containing many.

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

Use `/browser on` plus browser tools when you need live frontend state: DOM, network, console, local storage, forms, screenshots, or authenticated browser sessions. This drives a **separate Playwright Chromium** with its own empty profile, so you are logged in nowhere.

Use `pi-chrome` instead when the task depends on **being already signed in** — it drives your real Chrome profile. The two coexist: `browser_*` tools are Playwright, `chrome_*` tools are your real Chrome.

Browser dependencies are installed by `scripts/install-packages.sh`. If Chromium is missing:

```bash
cd ~/.pi/agent/extensions/browser
npx playwright-core install chromium
```

## Chrome profile control (pi-chrome)

`npm:pi-chrome` lets Pi use the Chrome profile you are already signed into, through a small Chrome extension bridged over loopback (`127.0.0.1:17318`). Use it for work that would otherwise require logging in again, or that depends on your existing session state.

### One-time setup

`pi install npm:pi-chrome` cannot finish the job — Chrome requires a human to load the extension:

```
/chrome onboard
```

That opens `chrome://extensions` and copies the bundled path. Then, in the browser: enable **Developer mode** → **Load unpacked** → `Cmd+Shift+G` → paste → Enter. Back in Pi:

```
/reload
/chrome doctor      # expect: ✓ Chrome is connected
```

**Load unpacked often does not take on the first attempt — do it twice.** The extension can end up listed but never actually running, which produces the confusing failure described under [Troubleshooting](#troubleshooting-pi-chrome) below. If `/chrome doctor` is not happy, load the folder again before investigating anything else.

### Brave (or any Chromium browser)

pi-chrome works in Brave unmodified — verified on Brave 151 with pi-chrome 0.15.46. Nothing in the bridge detects a browser; the companion extension simply polls `127.0.0.1:17318`, and its manifest is portable MV3 with no Web Store dependency.

Two differences from the Chrome path:

- Use `brave://extensions`. `/chrome onboard` tries to launch Google Chrome, which is harmless — press Esc and load the folder in Brave yourself. The path it copies is still correct.
- Every message says "Chrome", including `chrome://extensions` in error text. Read it as your Chromium browser.

Keep a browser window open: the connector is a service worker, and it stops polling when the browser quits. If automation misbehaves on one specific site, suspect Brave Shields before pi-chrome.

### Every session

Control is locked by default and must be authorized per session:

```
/chrome authorize            # 15 minutes
/chrome authorize 30m        # custom duration
/chrome authorize indefinite
/chrome revoke               # lock again
/chrome status
```

`/chrome background on` (the default) keeps it from stealing focus; `off` gives foreground watch mode.

### Notes

- The Chrome extension has broad tab and scripting permissions in your real profile. That is what makes it useful and what makes authorization deliberate.
- After `pi update`, `/chrome doctor` may report the loaded extension is older than the package — reload it from `chrome://extensions`.
- Screenshots land in `.pi/chrome-screenshots/` inside the project.
- It does not cover native Chrome/OS surfaces: print and save dialogs, permission bubbles, password-manager prompts, passkeys and biometrics, cross-origin iframe DOM, or CAPTCHA challenges. On strict-CSP pages, fall back to screenshots plus coordinate input.
- `/chrome revoke` closes only the calling session's automation target; your own tabs and windows are left alone.
- The first Pi session to bind `17318` owns the connection; later sessions share it and report "sharing another pi session's connection". Authorization is *not* shared — `/chrome authorize` is per session, because it lives on that process's `globalThis`.
- The bridge survives `/reload` by design, so `/reload` does **not** restart it. Changes to pi-chrome itself need a full Pi restart.

### Troubleshooting pi-chrome

Ask the bridge directly before touching anything. `/status` is read-only and safe:

```bash
curl -s http://127.0.0.1:17318/status | python3 -m json.tool
```

| Field | Meaning |
|---|---|
| `mode` | `server` = this machine's owner; `client` = sharing another session's connection. |
| `connected` | True when a poll arrived in the last 5 minutes. |
| `clientName` | `Pi Chrome Connector <id>` when the real extension is polling. |

**"last seen never" while the bridge is listening → the extension is not loaded.** `lastSeenAt` is only set when a poll is *accepted*, so "never" means no poll ever arrived. The fix is on the browser side: load the unpacked folder again (see above), or hit reload on the extension card. Do not go debugging the Pi side — a listening socket and a reachable `/status` already prove it is healthy.

Do not trust Brave's `Secure Preferences` on disk to tell you whether the extension loaded. It is written lazily, and its cached-manifest field reads empty even when the extension is running fine. The authoritative check is `clientName` in `/status`.

If a command is delivered but times out ("received the command but never returned a result"), the extension picked it up and never posted back. Note that the extension's `postResult` ignores the HTTP response, so a rejected POST fails silently. Reload the extension first.

## Prompt snippets

## Parked issues

When the agent notices something worth raising that is not what you asked about, it calls `park_issue` instead of interrupting you with it.

- **High severity** (security, data loss, destructive operations) prompts immediately.
- **Medium and low** queue silently and are triaged in one batch when the turn ends.
- Each prompt offers park / park-at-front / discard / other, so nothing enters the backlog unreviewed.

Severity is proposed by the model but passes through a hard-coded escalation list in `src/severity.ts`; phrases such as `credential`, `auth.json`, `--force`, and `rm -rf` force `high` regardless of the model's judgment.

Run `/parked` to review, reorder, resolve, or discard items, and to print the checklist. Open items live in the session ledger, so the list rewinds correctly under `/tree`.

### Closing an issue

Tell the agent an issue is done or should be dropped and it calls `close_parked_issue`:

- **resolve** closes it straight away — you already said the work was finished.
- **discard** asks for confirmation first, since dropping an unactioned issue is the destructive direction. Declining, or having no UI attached, leaves the issue open.

The durable backlog at `.parked/ISSUES.md` in the project root (gitignored) is **generated** from the session ledger on every sync. Editing it by hand does nothing: the next sync overwrites it. Closing an issue has to go through `close_parked_issue` or `/parked`.

Because the ledger is per-session, an issue parked in one session can only be closed from that session. `close_parked_issue` reports the outstanding issues it can actually see rather than failing silently.

### Handing work back to the agent

`/parked` can dispatch instead of just bookkeeping, so you no longer close the popup and retype the request.

| action | effect |
| --- | --- |
| `▶ Work on all N now` | Top row of the picker; hands every open issue over in one message |
| `Work on it now` | First action on a single issue |
| `Mark resolved` | Unchanged — closes the ledger entry **without doing the work** |
| `Back to open` | Only shown for dispatched work; puts a stalled issue back in the queue |

Dispatched issues move to a third status, **in progress**, rendered as `[~]` under `## In progress`. They are not marked resolved on dispatch, because a turn that ends halfway through the work would otherwise leave a backlog claiming something is fixed when it isn't. The agent is told to close each one with `close_parked_issue` only when the work is genuinely done, and to leave it in progress if it can't finish.

Two consequences worth knowing:

- `_Next:_` and the picker's "work on all" count deliberately name **open** issues only, so neither sends the agent to redo something already underway.
- Nothing reverts a stalled dispatch automatically. If a turn dies mid-issue, the issue sits in progress until you use `Back to open`.

The `prompt-snippets` extension provides temporary prompt toggles for recurring behaviors such as asking questions, delegating exploration, verifying assumptions, and orchestrator mode. Use its registered Pi commands after `/reload`.

## Session analysis

Use the `analyze-sessions` skill when asking Pi about past sessions, costs, prompts, or transcript search. It reads local session files under `~/.pi/agent/sessions/`; do not commit those files.
