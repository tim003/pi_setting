# GitHub SSH Persistence

## Purpose

Keep GitHub SSH access working across disposable host Pi restarts and package updates.

The private key lives under the host Pi runtime directory:

```text
~/.pi/agent/ssh/id_ed25519_pi_github
```

The key must never be committed.

## Current status

Verified 2026-09-01:

- SSH config points `github.com` to the persistent key.
- Git identity is `tim003 <tim003@users.noreply.github.com>`.
- `ssh -T git@github.com` authenticates as `tim003`.

## Extension

Backstop extension:

```text
extensions/github-ssh-persist.ts
```

Live path:

```text
~/.pi/agent/extensions/github-ssh-persist.ts
```

On Pi `session_start`, it idempotently restores SSH config, permissions, git identity, and Codex auth symlink compatibility.

## Verify

From macOS Terminal:

```bash
ls -l ~/.pi/agent/ssh/id_ed25519_pi_github
ssh -T git@github.com
 git config --global user.name
 git config --global user.email
```

Expected GitHub SSH output:

```text
Hi tim003! You've successfully authenticated, but GitHub does not provide shell access.
```

## Caveats

- Treat `~/.pi/agent/ssh/id_ed25519_pi_github` as a secret.
- Do not copy the key into this repo or into Obsidian notes.
- Keep `~/.pi/agent` backed up carefully if you depend on this SSH key.
- Revoking the key in GitHub settings immediately disables access.
