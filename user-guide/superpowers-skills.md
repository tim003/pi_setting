# Superpowers Skills

## Purpose

`git:github.com/obra/superpowers` installs process skills that guide coding-agent behavior, such as brainstorming, TDD, debugging, review, verification, and worktree usage.

## Current status

Installed and reconciled 2026-09-01 at ref `b36e082`.

## Common skills in use

- `using-superpowers` — skill discovery/use discipline.
- `brainstorming` — design before creative/behavioral changes.
- `systematic-debugging` — investigate before fixing bugs.
- `test-driven-development` — red/green/refactor for feature/bugfix work.
- `verification-before-completion` — evidence before completion claims.
- `requesting-code-review` / `receiving-code-review` — review workflows.
- `using-git-worktrees` — isolated feature work.

## Usage

The agent should load a skill when the task matches its description. You can also ask explicitly:

```text
Use the systematic-debugging skill for this issue.
```

or:

```text
Use brainstorming before implementing the custom cmux subagent extension.
```

## Update

```bash
pi update --extensions
```

Then `/reload` or restart Pi.

## Caveats

- Skills are instructions, not tools. They shape workflow and approval gates.
- Some skills require explicit user approval before implementation starts.
