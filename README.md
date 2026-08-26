# pi_setting

A curated, shareable backup of my Pi coding-agent setup.

This repository is intentionally **not** a full copy of `~/.pi/agent`. GitHub is used here for reproducible configuration and setup notes, not as a database for Pi runtime state.

## What's included

- Sanitized example settings:
  - `settings/settings.example.json`
  - `settings/web-search.example.json`
- Reinstall script for Pi packages:
  - `scripts/install-packages.sh`
- Notes on what should and should not be committed.

## What's intentionally excluded

Do not commit these from `~/.pi/agent`:

- `auth.json` — provider login/auth data.
- `models-store.json` — runtime provider/model cache.
- `sessions/` — conversation history.
- `npm/`, `git/`, `bin/` — installed/generated package directories.
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

### 1. Generate a dedicated key inside the container

Run inside the Pi/container shell:

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keygen -t ed25519 \
  -C "pi-container tim003 github" \
  -f /root/.ssh/id_ed25519_pi_github
```

A passphrase is optional. For unattended agent pushes, leave it empty.

This creates:

```text
/root/.ssh/id_ed25519_pi_github      # private key; keep inside container, never commit
/root/.ssh/id_ed25519_pi_github.pub  # public key; safe to add to GitHub
```

### 2. Configure SSH inside the container

Append this to `/root/.ssh/config` inside the container:

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/id_ed25519_pi_github
  IdentitiesOnly yes
```

Then secure the file:

```bash
chmod 600 /root/.ssh/config
```

This does not modify the host Mac SSH config at `/Users/tw/.ssh/config`.

### 3. Add the public key to GitHub

Print the public key:

```bash
cat /root/.ssh/id_ed25519_pi_github.pub
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

## Updating

Update installed Pi packages with:

```bash
pi update --extensions
```

Update Pi itself with:

```bash
pi update --self
```
