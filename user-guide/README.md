# Pi Setting User Guide

Operational guides for the Pi setup in this repo. Keep one guide per skill or extension so the main README stays short.

## Extensions and package features

- [Pi subagents](pi-subagents.md)
- [cmux interactive subagents](cmux-interactive-subagents.md)
- [Pi web access](pi-web-access.md)
- [Pi Claude auth](pi-claude-auth.md)
- [Codex CLI auth](codex-cli-auth.md)
- [GitHub SSH persistence](github-ssh-persist.md)
- [Host safety guard](host-safety-guard.md)
- [Bash guard](bash-guard.md)
- [Ask user question](ask-user-question.md)
- [Browser](browser.md)
- [Prompt snippets](prompt-snippets.md)
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

- `npm:pi-subagents` remains installed for packaged Markdown agent definitions but is filtered/disabled as an extension provider.
- `git:github.com/HazAT/pi-interactive-subagents` is no longer installed by the base script; the local cmux provider replaces it.
- The custom cmux-only interactive subagent extension is active under `~/.pi/agent/extensions/cmux-interactive-subagents`; it requires direct `cmux` and `CMUX_SOCKET_PATH` access.
- cmux subagent launch and resume smoke tests passed with `openai-codex/gpt-5.5`; default Anthropic child launch/resume also passed after patching the launcher to explicitly load `pi-claude-auth` in child Pi processes.
- Claude Code-backed Anthropic OAuth is verified after `claude auth login --claudeai`.
- `host-safety-guard` is installed and tested; `~/Desktop/pi-inbox` exists for screenshot/image reads.
- `bash-guard`, `ask-user-question`, `browser`, `prompt-snippets`, and `web_fetch` are vendored from `amosblomqvist/pi-config` and installed locally.
- Browser tools remain opt-in via `/browser on`.
- Observational memory is installed but gated per session with `/om on`.
- Old Docker wrapper/image/volume cleanup is deferred for rollback safety.
