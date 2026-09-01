# Ask User Question

## Purpose

`ask-user-question` is a local extension from `amosblomqvist/pi-config` that lets Pi ask a structured question through the interactive TUI instead of burying choices in normal chat text.

It is useful when an agent needs a clear user decision before continuing.

## Current status

Installed live 2026-09-01:

```text
~/.pi/agent/extensions/ask-user-question/
```

Source path in this repo:

```text
extensions/ask-user-question/
```

The source was normalized to import current `@earendil-works/*` Pi packages and packaged with an explicit `typebox` dependency.

## Tool behavior

The tool can ask:

- free-form text questions
- single-choice questions
- multi-select questions

When options are provided, the UI also allows an `Other` custom answer.

## Usage guidance

Use this for decisions that genuinely require user input, for example:

- choosing between implementation approaches
- approving a potentially risky operation
- selecting which environment/account to use

Do not use it for questions the agent can answer by reading files, docs, logs, or test output.

## Reload

Run `/reload` or restart Pi after changing this extension.
