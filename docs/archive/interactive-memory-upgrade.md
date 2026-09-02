# Interactive Subagents + Observational Memory Upgrade Plan

Date: 2026-09-01

Status: **historical/superseded after host Pi migration**. The current base install uses the local `cmux-interactive-subagents` extension as the active provider and no longer installs `git:github.com/HazAT/pi-interactive-subagents`.

## Goal

Adopt selected ideas from Amos Blomqvist's Pi setup without cloning over the existing Pi config:

- Use the local `cmux-interactive-subagents` extension for pane-based interactive subagents.
- Add `amosblomqvist/pi-observational-memory`, gated off by default.
- Add Amos's selected skills: `analyze-sessions`, `pdf-reader`, `web-debug`, `youtube-transcript`.
- Add Amos's `web_fetch` extension for clean URL-to-Markdown fetching.

## Safety constraints

- Do not overwrite `~/.pi/agent` wholesale.
- Keep credential files out of git: `auth.json`, `codex/auth.json`, `ssh/`, sessions, `.memory/`.
- Avoid duplicate `subagent` tool providers. Keep `npm:pi-subagents` installed for packaged agent definitions, but disable its extension resources while local `cmux-interactive-subagents` is active.
- Keep observational memory off until explicitly enabled with `/om on`.
- Add `.memory/` to ignore rules before using observational memory in a repo.

## Package decisions

| Component | Source | Decision |
|---|---|---|
| Interactive subagents | Local `extensions/cmux-interactive-subagents/` | Installed active on host Pi. Requires direct `cmux` and `CMUX_SOCKET_PATH`; child launcher explicitly loads `pi-claude-auth` so Anthropic child models use Claude Code OAuth. |
| Existing subagents | `npm:pi-subagents` | Keep installed for packaged Markdown agent definitions and rollback/reference, but disable its extension resources to avoid duplicate `subagent` tools. |
| Observational memory | `git:github.com/amosblomqvist/pi-observational-memory` | Install; default off per session. |
| Web fetch | Amos `pi-config/extensions/web-fetch` | Copy as a local extension with dependencies installed. |
| Web search | Existing `npm:pi-web-access` | Keep; do not duplicate Amos's web search extension. |
| Skills | Amos `pi-config/skills/*` | Copy selected skill folders into `~/.pi/agent/skills/`. |

## Verification checklist

1. Backup live `~/.pi/agent/settings.json` before changes.
2. Install/test packages in an isolated `PI_CODING_AGENT_DIR` first.
3. Install live packages.
4. Keep `npm:pi-subagents` installed but extension-disabled while local `cmux-interactive-subagents` is active.
5. Copy local extension/skills and install extension-local dependencies.
6. Add `.memory/` to root vault ignore rules if missing.
7. Run `/reload` in Pi.
8. Verify:
   - `subagent` comes from the local cmux provider.
   - Anthropic child launch/resume works, proving child `pi-claude-auth` loading.
   - `/om:status` works while off.
   - `web_fetch` appears and can fetch a simple URL.
   - GitHub SSH and Codex CLI credentials still work.

## Rollback

Restore the pre-change settings backup from `~/.pi/agent/update-tracking/`, remove or rename copied local extensions/skills, then run `/reload`.
