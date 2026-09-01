# Prompt Snippets

## Purpose

`prompt-snippets` is a local extension from `amosblomqvist/pi-config` for temporarily applying reusable prompt rules to one outgoing message.

It is useful for one-off modes such as verification emphasis, orchestrator mode, or question-asking discipline without permanently changing global instructions.

## Current status

Installed live 2026-09-01:

```text
~/.pi/agent/extensions/prompt-snippets/
```

Source path in this repo:

```text
extensions/prompt-snippets/
```

Vendored snippets:

- `ask-questions.md`
- `delegate-exploration.md`
- `diagnose-report.md`
- `orchestrator-mode.md`
- `session-kickoff.md`
- `verify-not-assume.md`

## Usage

Open the snippet menu in interactive Pi:

```text
/snippets
```

or press:

```text
Alt+s
```

Controls:

- Space: toggle snippet
- Tab: preview
- Enter: apply
- Esc: cancel

Active snippets reset after the next message and at session start.

## Custom snippets

Add markdown files under:

```text
~/.pi/agent/extensions/prompt-snippets/snippets/
```

Each file should use frontmatter with `name`, `description`, `placement`, and `order`, followed by the snippet body.

Run `/reload` or restart Pi after changing extension code. Snippet markdown is re-read when the menu opens or a message is sent.
