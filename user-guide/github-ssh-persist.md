# GitHub SSH Persistence

## Purpose

Keep GitHub SSH access working across disposable Docker container restarts and image rebuilds.

The private key lives on the persistent Pi volume:

```text
/root/.pi/agent/ssh/id_ed25519_pi_github
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
/root/.pi/agent/extensions/github-ssh-persist.ts
```

On Pi `session_start`, it idempotently restores SSH config, permissions, git identity, and Codex auth symlink compatibility.

## Verify

Inside the container:

```bash
ls -l /root/.pi/agent/ssh/id_ed25519_pi_github
ssh -T git@github.com
 git config --global user.name
 git config --global user.email
```

Expected GitHub SSH output:

```text
Hi tim003! You've successfully authenticated, but GitHub does not provide shell access.
```

## Caveats

- `/root/.ssh/` is ephemeral container overlay state.
- `/root/.pi/agent` is the persistent volume.
- Removing the Docker volume `pi-agent-home` destroys the persistent key and Codex auth.
- Revoking the key in GitHub settings immediately disables access.
