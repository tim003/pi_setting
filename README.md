# pi_setting

A curated, shareable backup of my Pi coding-agent setup.

This repository is intentionally **not** a full copy of `~/.pi/agent`. GitHub is used here for reproducible configuration and setup notes, not as a database for Pi runtime state.

## What's included

- Sanitized example settings:
  - `settings/settings.example.json`
  - `settings/web-search.example.json`
- Reinstall script for Pi packages:
  - `scripts/install-packages.sh`
- Extensions that restore ephemeral container state on startup:
  - `extensions/github-ssh-persist.ts`
- Notes on what should and should not be committed.

## What's intentionally excluded

Do not commit these from `~/.pi/agent`:

- `auth.json` — provider login/auth data.
- `models-store.json` — runtime provider/model cache.
- `sessions/` — conversation history.
- `npm/`, `git/`, `bin/` — installed/generated package directories.
- `ssh/` — the persistent container SSH private key. Never commit this; only
  the `.pub` half is safe to share, and it belongs in GitHub settings, not here.
- `.env`, tokens, API keys, credentials, logs, caches, databases.

## Current package setup

This setup currently installs:

```bash
pi install npm:pi-claude-auth
pi install git:github.com/obra/superpowers
pi install npm:pi-subagents
pi install npm:pi-web-access
```

Or run:

```bash
./scripts/install-packages.sh
```

## Restoring settings

Review the examples first, then copy them into your Pi config directory if appropriate:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR"
cp settings/settings.example.json "$PI_DIR/settings.json"
cp settings/web-search.example.json "$PI_DIR/web-search.json"
```

Then authenticate locally with your own accounts/keys, for example by running Pi and using `/login`.

## GitHub push access from Pi/container

For this setup, Pi runs inside a container. The host Mac uses 1Password SSH agent, but that agent is not automatically available inside the container. To let Pi push commits directly, use a dedicated container SSH key rather than copying a personal/private host key into the container.

> **Corrected 2026-08-28 — the key must NOT live in `/root/.ssh`.**
> The container runs with `docker run --rm`, so `/root/.ssh` is part of the
> throwaway overlay filesystem and is destroyed on every exit. A key written
> there disappears on the next start, and its public half becomes an orphaned
> entry in GitHub settings. This was discovered after a `pi-container` key
> silently stopped existing; a fresh container was only ~90 minutes old and
> retained no trace of it.
>
> Only these paths persist:
>
> | Path | Mechanism | Persists |
> |---|---|---|
> | `/workspace` | virtiofs bind mount of the vault | yes |
> | `/root/.pi/agent` | named volume `pi-agent-home` | **yes — key lives here** |
> | `/root/.claude/.credentials.json` | single-file bind mount | yes |
> | `/root/.ssh/pi_deploy` | single-file bind mount, read-only | yes (VPS only) |
> | `/root/.ssh/` *(the directory)* | container overlay | **no** |
>
> Note `pi_deploy` only appears to survive — it is re-injected from the host on
> every start. The directory around it is not persistent.

### 1. Generate a dedicated key on the persistent volume

Run inside the Pi/container shell:

```bash
mkdir -p /root/.pi/agent/ssh
chmod 700 /root/.pi/agent/ssh
ssh-keygen -t ed25519 \
  -C "pi-container tim003 github" \
  -f /root/.pi/agent/ssh/id_ed25519_pi_github
```

A passphrase is optional. For unattended agent pushes, leave it empty.

This creates:

```text
/root/.pi/agent/ssh/id_ed25519_pi_github      # private key; persistent, never commit
/root/.pi/agent/ssh/id_ed25519_pi_github.pub  # public key; safe to add to GitHub
```

Because `/root/.pi/agent` is the `pi-agent-home` named volume (the same one that
keeps your `/login` across runs), this key survives container restarts and
rebuilds. **You register the public key with GitHub exactly once.**

### 2. Restore SSH config automatically on every start

`/root/.ssh/config` is ephemeral and cannot hold the setting permanently. The
extension [`extensions/github-ssh-persist.ts`](extensions/github-ssh-persist.ts)
recreates it on every `session_start`.

Install it once — extensions in `~/.pi/agent/extensions/` are auto-discovered at
startup and live in the same persistent volume, so the extension survives too:

```bash
mkdir -p /root/.pi/agent/extensions
cp extensions/github-ssh-persist.ts /root/.pi/agent/extensions/
```

On each start it idempotently appends the `github.com` block to
`/root/.ssh/config`, fixes permissions, and restores the git commit identity
(`~/.gitconfig` is ephemeral as well — without this, commits fail with
"Please tell me who you are" in every fresh container).

The block it writes:

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.pi/agent/ssh/id_ed25519_pi_github
  IdentitiesOnly yes
```

The image-provided `Host fabcafe` block is left untouched, and the host Mac SSH
config at `/Users/tw/.ssh/config` is not modified.

### 3. Add the public key to GitHub

Print the public key:

```bash
cat /root/.pi/agent/ssh/id_ed25519_pi_github.pub
```

In GitHub:

```text
Settings → SSH and GPG keys → New SSH key
```

Use:

```text
Title: pi-container
Key type: Authentication Key
Key: paste the public key line
```

If GitHub rejects the comment at the end of the key, paste only the `ssh-ed25519 AAAA...` portion.

### 4. Test from inside the container

```bash
ssh -T git@github.com
```

Expected result:

```text
Hi tim003! You've successfully authenticated, but GitHub does not provide shell access.
```

Then Pi can push repos whose remotes use SSH, for example:

```bash
git remote -v
git push
```

Verified working 2026-08-28: authentication as `tim003`, read access to private
repos, and the restore path exercised by deleting `/root/.ssh/config` and
confirming the extension logic rebuilt it (twice, without duplicating the block).

### 5. Scope and blast radius

This is an **account-level** key, so it grants push access to **every repository
the account owns** — including collaborative repos such as `jsdwwjr/navi`. Pi has
no permission prompts and no command allowlist, so anything the agent runs with
this key is unreviewed.

That is a deliberate trade-off, and it is a different shape from the VPS access
design in [`../vps-ssh-access.md`](../vps-ssh-access.md), where the key is
`from=`-pinned, forced-command, and limited to one script. If you want the same
narrowness here, the alternative is a **per-repository deploy key** with write
access enabled: one key per repo, blast radius of exactly one repo.

Revoke at any time via GitHub → Settings → SSH and GPG keys → delete
`pi-container`. Revocation is immediate and affects nothing else.

## Updating

Update installed Pi packages with:

```bash
pi update --extensions
```

Update Pi itself with:

```bash
pi update --self
```
