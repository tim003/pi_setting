# Provenance of local extensions and skills

Everything under `extensions/` and `skills/` is copied into `~/.pi/agent/` by
`scripts/install-packages.sh`. Most of it did not originate here.

Upstream: [amosblomqvist/pi-config](https://github.com/amosblomqvist/pi-config),
compared at `f82da56` (2026-08-25). That repo is explicitly meant to be
cherry-picked from rather than installed as a whole, which is how these arrived.

This repo is private, and these are personal working copies.

## Why they are vendored rather than installed

They are not Pi packages — there is nothing for `pi install` to fetch. Beyond
that, upstream still imports the **old package names**:

```
@mariozechner/pi-coding-agent   ->  @earendil-works/pi-coding-agent
@mariozechner/pi-tui            ->  @earendil-works/pi-tui
@sinclair/typebox               ->  typebox
```

So upstream files will not run against current Pi without that rename. Every
"modification" below other than `bash-guard`'s is essentially this port.

## Extensions

| Extension | Origin | Local changes |
|---|---|---|
| `ask-user-question` | upstream `extensions/ask-user-question.ts` | restructured from a single file into a directory with its own `package.json`; dependency rename |
| `bash-guard` | upstream `extensions/bash-guard/` | dependency rename, **plus a functional change**: `PI_BASH_GUARD_LEVEL` prompt threshold (see below) |
| `browser` | upstream `extensions/browser/` | `package.json` dependency rename only; `index.ts` unchanged |
| `prompt-snippets` | upstream `extensions/prompt-snippets/` | added a `package.json` (upstream has none) |
| `web-fetch` | upstream `extensions/web-fetch/` | dependency rename in `index.ts` and `package.json` |
| `host-safety-guard` | **originates here** | n/a |
| `cmux-interactive-subagents` | **originates here** | n/a — upstream ships only a stub pointing at the separate `pi-interactive-subagents` repo |

### The one behavioural divergence: `bash-guard`

Upstream classifies commands as `high` or `medium` severity but has **no gate** —
anything it detects prompts, including routine `git`. This copy adds:

```ts
const _promptOnMedium = String(process.env.PI_BASH_GUARD_LEVEL ?? "").trim().toLowerCase() === "strict";
function shouldPrompt(risk: Risk): boolean {
  return risk.severity === "high" || _promptOnMedium;
}
```

Default is therefore high-only; `PI_BASH_GUARD_LEVEL=strict` restores upstream
behaviour. Catastrophic commands stay hard-blocked in both modes.

This change lived only in `~/.pi/agent` for a while and was not committed. If it
goes missing again, a reinstall from this repo is the likely cause — check that
`extensions/bash-guard/index.ts` still contains `shouldPrompt`.

## Skills

`analyze-sessions`, `pdf-reader`, `web-debug`, and `youtube-transcript` are
**byte-identical** to upstream. No local changes.

## Porting upstream fixes

`pi update` does not touch any of this — these are copies, not packages. To pull
in an upstream fix:

```bash
git clone https://github.com/amosblomqvist/pi-config /tmp/pi-config
diff -ru /tmp/pi-config/extensions/<name> extensions/<name> \
  -x node_modules -x package-lock.json
```

Expect the dependency rename to show up as noise in every diff. Re-apply the
rename after porting, and for `bash-guard` re-apply the `shouldPrompt` gate.
Then run `./scripts/install-packages.sh` and `/reload`.
