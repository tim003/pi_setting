# Interactive Subagents + Observational Memory Upgrade Plan

Date: 2026-09-01

## Goal

Adopt selected ideas from Amos Blomqvist's Pi setup without cloning over the existing Pi config:

- Use the cmux-capable upstream `HazAT/pi-interactive-subagents` for pane-based interactive subagents.
- Add `amosblomqvist/pi-observational-memory`, gated off by default.
- Add Amos's selected skills: `analyze-sessions`, `pdf-reader`, `web-debug`, `youtube-transcript`.
- Add Amos's `web_fetch` extension for clean URL-to-Markdown fetching.

## Safety constraints

- Do not overwrite `/root/.pi/agent` wholesale.
- Keep credential files out of git: `auth.json`, `codex/auth.json`, `ssh/`, sessions, `.memory/`.
- Avoid duplicate `subagent` tool providers. The existing `npm:pi-subagents` extension must be disabled or removed before enabling `HazAT/pi-interactive-subagents`.
- Keep observational memory off until explicitly enabled with `/om on`.
- Add `.memory/` to ignore rules before using observational memory in a repo.

## Package decisions

| Component | Source | Decision |
|---|---|---|
| Interactive subagents | `git:github.com/HazAT/pi-interactive-subagents` | Installed but extension disabled for now. Its cmux backend expects `CMUX_SOCKET_PATH` and a `cmux` command inside the Pi process; the current Pi process runs in a Linux Docker container while cmux is a macOS host app. Do not enable until a container-to-host cmux bridge exists. |
| Existing subagents | `npm:pi-subagents` | Keep active for now; it is the verified working provider for normal async subagents and Codex smoke tests. |
| Observational memory | `git:github.com/amosblomqvist/pi-observational-memory` | Install; default off per session. |
| Web fetch | Amos `pi-config/extensions/web-fetch` | Copy as a local extension with dependencies installed. |
| Web search | Existing `npm:pi-web-access` | Keep; do not duplicate Amos's web search extension. |
| Skills | Amos `pi-config/skills/*` | Copy selected skill folders into `/root/.pi/agent/skills/`. |

## Verification checklist

1. Backup live `/root/.pi/agent/settings.json` before changes.
2. Install/test packages in an isolated `PI_CODING_AGENT_DIR` first.
3. Install live packages.
4. Keep `npm:pi-subagents` active and keep `HazAT/pi-interactive-subagents` disabled until the cmux bridge is solved.
5. Copy local extension/skills and install extension-local dependencies.
6. Add `.memory/` to root vault ignore rules if missing.
7. Run `/reload` in Pi.
8. Verify:
   - `subagent` still comes from the verified `npm:pi-subagents` package until the cmux bridge is solved.
   - `/om:status` works while off.
   - `web_fetch` appears and can fetch a simple URL.
   - GitHub SSH and Codex CLI credentials still work.

## Rollback

Restore the pre-change settings backup from `/root/.pi/agent/update-tracking/`, remove or rename copied local extensions/skills, then run `/reload`.
