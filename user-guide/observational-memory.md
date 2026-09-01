# Observational Memory

## Purpose

Observational memory records and consolidates session observations into `.memory/` files for later recall.

Package:

```text
git:github.com/amosblomqvist/pi-observational-memory
```

## Current status

Installed, but gated per session. It does not need to be active for every session.

Memory output is ignored by git:

```text
.memory/
```

## Commands

Inside Pi:

```text
/om:status
/om on
/om off
/om:compact
/om:consolidate
```

Use `/om on` only for sessions where persistent observational notes are useful.

## Configuration

The example settings configure observer/consolidator models and keep passive/debug behavior explicit. See:

```text
settings/settings.example.json
```

## Verify

1. Run `/om:status`.
2. Run `/om on`.
3. Do a small task.
4. Check whether a `.memory/` directory was created in the current project.
5. Run `/om off` if you do not want continued recording.

## Caveats

- `.memory/` is runtime state, not source documentation. Do not commit it.
- It may consume additional tokens/model calls while active.
- Disable it for sensitive/private sessions unless you explicitly want observations stored locally.
