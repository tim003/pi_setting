# Bash Guard

## Purpose

`bash-guard` is a local extension from `amosblomqvist/pi-config` that reviews `bash` tool calls before execution.

It is complementary to `host-safety-guard`:

- `bash-guard` focuses on destructive or risky shell commands.
- `host-safety-guard` focuses on host filesystem boundaries and Desktop/pi-inbox access.

## Current status

Installed live 2026-09-01:

```text
~/.pi/agent/extensions/bash-guard/
```

Source path in this repo:

```text
extensions/bash-guard/
```

## Behavior

In a main interactive Pi session, suspicious commands prompt before running. Examples include:

- `rm -rf`
- `sudo`
- `git reset --hard`
- `git clean -f`
- forced pushes
- disk utilities such as `diskutil`, `mkfs`, `dd of=...`
- remote-code patterns such as `curl ... | sh`

In non-interactive subagent mode, catastrophic commands are hard-blocked instead of prompting.

## Commands and flags

Inside Pi:

```text
/bash-guard
```

Toggles the guard for the current session. Even when disabled, the extension keeps a catastrophic-operation block floor.

Flags:

```text
--bash-guard-disabled
--bash-guard-auto-allow
```

Use these only intentionally; the default interactive mode is the safe mode.

## Verify

The extension currently has no local test suite. Verify operationally after `/reload` by attempting a harmless flagged command such as:

```bash
git status
```

Expected: interactive confirmation prompt in the main Pi session.
