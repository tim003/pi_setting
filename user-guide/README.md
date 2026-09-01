# Pi Setting User Guide

Operational guides for the Pi setup in this repo. Keep one guide per skill or extension so the main README stays short.

## Extensions and package features

- [Pi subagents](pi-subagents.md)
- [cmux interactive subagents](cmux-interactive-subagents.md)
- [Pi web access](pi-web-access.md)
- [Pi Claude auth](pi-claude-auth.md)
- [Codex CLI auth](codex-cli-auth.md)
- [GitHub SSH persistence](github-ssh-persist.md)
- [Web fetch](web-fetch.md)
- [Observational memory](observational-memory.md)
- [Package update and reload workflow](package-update-and-reload.md)
- [Rollback procedures](rollback.md)

## Skills

- [YouTube transcript](youtube-transcript.md)
- [PDF reader](pdf-reader.md)
- [Web debug](web-debug.md)
- [Analyze sessions](analyze-sessions.md)
- [Superpowers skills](superpowers-skills.md)

## Current live status

As of the 2026-09-01 verification notes, Pi runs directly on the macOS host as the primary runtime. See `../../host-migration.md` from the parent `Pi/` folder.

Current live state:

- `npm:pi-subagents` and `git:github.com/HazAT/pi-interactive-subagents` remain installed but filtered/disabled as extension providers.
- The custom cmux-only interactive subagent extension is active under `~/.pi/agent/extensions/cmux-interactive-subagents`; it requires direct `cmux` and `CMUX_SOCKET_PATH` access.
- cmux subagent launch and resume smoke tests passed with `openai-codex/gpt-5.5`; default Anthropic child launch/resume also passed after patching the launcher to explicitly load `pi-claude-auth` in child Pi processes.
- Claude Code-backed Anthropic OAuth is verified after `claude auth login --claudeai`.
- `web_fetch` is vendored locally and verified.
- Observational memory is installed but gated per session with `/om on`.
- Old Docker wrapper/image/volume cleanup is deferred for rollback safety.
