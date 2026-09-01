# Analyze Sessions Skill

## Purpose

Analyze previous Pi session transcripts and usage data under:

```text
~/.pi/agent/sessions
```

Use for:

- cost totals
- usage by project/model/day
- searching past prompts
- viewing a specific past session
- mining prompting patterns

Skill path:

```text
skills/analyze-sessions/
```

## Usage examples

Ask Pi:

```text
Use analyze-sessions to summarize my Pi token/cost usage by day for the last week.
```

Or:

```text
Search past Pi sessions for mentions of pi-subagents model verification.
```

## Caveats

- Session transcripts can contain sensitive information. Treat outputs as local/private unless reviewed.
- Large searches should use filters by date, project, model, or query terms.
