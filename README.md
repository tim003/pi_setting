# pi_setting

A curated, shareable backup of my Pi coding-agent setup.

This repository is intentionally **not** a full copy of `~/.pi/agent`. GitHub is used here for reproducible configuration and setup notes, not as a database for Pi runtime state.

## Documentation maintenance note

Pi documentation is split across the parent Obsidian `Research/Pi` folder and this nested
`pi_setting` repo. When checking or updating relevant Pi Markdown, include **both**:

- `Research/Pi/*.md`
- `Research/Pi/pi_setting/*.md`

This repo has its own Git remote and should be committed/pushed from here. The parent
`Research/Pi/*.md` files belong to the vault root repo, which currently has no remote.

## What's included

- Sanitized example settings:
  - `settings/settings.example.json`
  - `settings/web-search.example.json`
- Reinstall script for Pi packages:
  - `scripts/install-packages.sh`
- Extensions:
  - `extensions/github-ssh-persist.ts` — SSH config, git identity, codex CLI auth link
  - `extensions/web-fetch/` — Amos-inspired `web_fetch` URL-to-clean-Markdown tool, vendored locally with dependencies
- Script to re-apply the pi-subagents model-verification patch:
  - `scripts/patch-model-verification.sh`
- Selected skills vendored from `amosblomqvist/pi-config`:
  - `skills/analyze-sessions/`
  - `skills/pdf-reader/`
  - `skills/web-debug/`
  - `skills/youtube-transcript/`
- Upgrade notes:
  - `UPGRADE_INTERACTIVE_MEMORY.md`
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

## Subagent models

`settings.example.json` pins a model per subagent role. Two reasons this block
exists rather than letting roles inherit the session model:

**1. Cost.** Builtin agents inherit the parent session model, which is the most
capable and most expensive one. Every mechanical subagent task would run on
Opus unless told otherwise.

**2. Model aliases used to produce a false "failed" status — now patched.**
Launching a child with an *alias* such as `anthropic/claude-sonnet-4-6` produced
a post-run check failure:

```
model_verification_failed: child reported a different model than the launch
candidate. Expected 'anthropic/claude-sonnet-4-6:high'
             but observed 'claude-sonnet-4-6-20260115'
```

The child boots, does the work, returns its output — and *then* the run is
marked `failed`, because pi-subagents compares the alias you launched with
against the dated snapshot id the provider actually served. The work is fine;
only the status is wrong — but that makes run status useless as a signal and
forces hand-verification of every result.

This is a bug, not a configuration choice: the same source file already defines
`stripTrailingDateStamp()` and applies it when *resolving* a model, just not
when *verifying* one. There is no setting to disable the check.

**Fix:** [`scripts/patch-model-verification.sh`](scripts/patch-model-verification.sh)
applies that same normalization to the verification path. It is idempotent and
takes effect without a Pi restart. Verified 2026-08-29: with the patch,
`anthropic/claude-haiku-4-5` and `anthropic/claude-sonnet-4-6` both complete
cleanly as aliases (`reviewer complete (claude-sonnet-4-6 · thinking high)`).

Re-verified 2026-09-01 after updating `pi-subagents` to `0.62.0`: the package
still false-failed an alias-model run after the child completed successfully:

```text
model_verification_failed: child reported a different model than the launch
candidate. Expected 'anthropic/claude-haiku-4-5'
             but observed 'claude-haiku-4-5-20251001'.
```

The patch script was updated for the `0.62.x` source shape, re-applied to the
live install, and the same alias-model run then reported `State: complete`.

The rejected alternative was pinning every agent to a dated id. That works, but
forces older snapshots — the newest models frequently expose no dated id at all,
so it silently caps you to whatever last got a date stamp.

`node_modules` lives in the `pi-agent-home` volume, so the patch survives
restarts and image rebuilds. **Re-run it after `pi update --extensions`,** which
reinstalls the package and reverts it.

Use `subagent({ action: "models" })` to list the exact ids available.

## Codex: two separate things

Having one does **not** give you the other, which is what makes this confusing:

| | What it is | How to authenticate |
|---|---|---|
| **openai-codex provider models** (`gpt-5.6-sol`, etc.) | Pi talks to the API over OAuth. No binary involved. | Pi's `/login` |
| **`codex-exec` / `codex-exec-writer` subagents** | Shell out to the `codex` CLI binary | `codex login --device-auth` |

A session can happily switch to `openai-codex/gpt-5.6-sol` while `codex-exec`
still fails with `External CLI binary 'codex' was not found on PATH` — or, once
installed, with `401 Unauthorized`. They are different credentials in different
stores.

### Logging in the CLI (headless container)

The normal `codex login` starts a loopback server on `localhost:1455`, which a
browser on the Mac cannot reach inside the container. Use device auth instead:

```bash
codex login --device-auth
```

It prints a URL (`https://auth.openai.com/codex/device`) and a one-time code.
Complete it in any browser, then confirm with `codex login status`.

### The persistence trap, again

The CLI defaults its auth store to `/root/.codex` — **ephemeral overlay**, the
same trap that ate the GitHub SSH key. `Dockerfile.pi` therefore sets:

```dockerfile
ENV CODEX_HOME=/root/.pi/agent/codex
```

so the credential lands on the `pi-agent-home` volume and one login lasts.
`github-ssh-persist.ts` additionally symlinks `/root/.codex/auth.json` to that
persistent copy, as a backstop for containers built before this change.

Note `pi auth print-bearer-token --provider openai-codex | codex login
--with-access-token` does **not** work — the CLI rejects Pi's token with
"agent identity JWT payload is not valid JSON". The two auth systems are not
interchangeable; log in to each separately.

## Current package setup

This setup currently installs:

```bash
pi install npm:pi-claude-auth
pi install git:github.com/obra/superpowers
pi install npm:pi-subagents
pi install npm:pi-web-access
```

Verified versions after the 2026-09-01 package update:

| Package | Version / ref |
|---|---|
| `pi-claude-auth` | `0.1.3` |
| `pi-subagents` | `0.62.0` — still active; verified working provider for current async subagents |
| `pi-web-access` | `0.27.0` |
| `github.com/obra/superpowers` | `b36e082` |
| `github.com/HazAT/pi-interactive-subagents` | installed but extension disabled until Docker↔cmux control is solved |
| `github.com/amosblomqvist/pi-observational-memory` | installed; gated off per session until `/om on` |

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

### 2. Make the SSH config survive container restarts

`/root/.ssh/config` is ephemeral, so the `github.com` stanza has to come from
somewhere durable on every start. There are two layers, and the first is
preferred.

#### Primary: baked into the image (survives everything)

`Research/Pi/container/Dockerfile.pi` writes the stanza at build time, alongside
the existing `fabcafe` one:

```sshconfig
Host github.com
    HostName github.com
    User git
    IdentityFile /root/.pi/agent/ssh/id_ed25519_pi_github
    IdentitiesOnly yes
    StrictHostKeyChecking yes
    PasswordAuthentication no
```

The key itself is **never baked into the image** — only the config naming it. The
image also gains `github.com` host keys in `pi_known_hosts` (verified against
`https://api.github.com/meta`) so `StrictHostKeyChecking yes` works, plus a
`/root/.gitconfig` with the commit identity.

Because Pi is not involved, this survives `pi update --self`, extension updates,
and any future extension-API change. **It requires an image rebuild to take
effect:**

```bash
cd Research/Pi/container && docker build -t pi-sandbox -f Dockerfile.pi .
```

#### Backstop: the auto-restore extension

[`extensions/github-ssh-persist.ts`](extensions/github-ssh-persist.ts) does the
same job from inside Pi, for containers running an image built before the change:

```bash
mkdir -p /root/.pi/agent/extensions
cp extensions/github-ssh-persist.ts /root/.pi/agent/extensions/
```

On each `session_start` it idempotently appends the `github.com` block if absent,
fixes permissions, and restores the git identity. Once the rebuilt image is in
use the extension finds its work already done and does nothing — harmless, and
worth keeping as insurance.

A third fallback, `ssh/bootstrap-github-ssh.sh` on the volume, does the same from
a plain shell if both other layers ever fail.

In all cases the `Host fabcafe` block is left untouched, and the host Mac SSH
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

Verified working 2026-08-28: authentication as `tim003`, read and push access to
private repos (this repo's own history is the evidence), and the restore path
exercised by deleting `/root/.ssh/config` and confirming a real `pi -p` session
rebuilt it via the extension — twice, without duplicating the block.

### 4b. What survives what

| Action | GitHub access survives? |
|---|---|
| Container exit / restart (`--rm`) | yes |
| `pi update --extensions` | yes |
| `pi update --self` | yes (and the update itself does not persist) |
| `docker build` image rebuild | yes — named volumes are independent of images |
| `docker volume rm pi-agent-home` | **no** — this is the one that destroys it |
| Revoking the key in GitHub settings | no |

The volume's independence is not theoretical: its contents are dated days
*before* the image currently running, so it has already outlived at least one
rebuild.

Note separately that **`pi update --self` does not persist** — it writes to
`/usr/local/lib/node_modules`, an image layer. Durable Pi upgrades require
rebuilding the image:

```bash
cd Research/Pi/container
docker build --no-cache -t pi-sandbox -f Dockerfile.pi .
```

`--no-cache` is not optional here. Docker caches the `RUN npm install -g` layer,
and since the Dockerfile text does not change between Pi releases, a plain
rebuild can reuse a stale version and leave you exactly where you started.

Verify afterwards with `pi --version` against
`npm view @earendil-works/pi-coding-agent version`.

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

## Interactive subagents and observational memory

The cmux-capable upstream is installed for evaluation:

```bash
pi install git:github.com/HazAT/pi-interactive-subagents
```

However, it is **disabled in the current live settings**:

```json
{ "source": "git:github.com/HazAT/pi-interactive-subagents", "extensions": [] }
```

Reason: its cmux backend expects both `CMUX_SOCKET_PATH` and a runnable `cmux` command inside
the Pi process. In this setup, Pi runs inside a Linux Docker container while cmux is a macOS
host app, so the extension cannot create cmux panes as-is. Keep the verified
`npm:pi-subagents` extension active until a Docker↔cmux bridge exists.

Do not enable both `npm:pi-subagents` and `HazAT/pi-interactive-subagents` extensions at the
same time: both register a `subagent` tool. After changing package/resource settings, run
`/reload` or restart Pi.

Observational memory is installed from:

```bash
pi install git:github.com/amosblomqvist/pi-observational-memory
```

It is gated off per session. Use:

```text
/om:status
/om on
/om off
```

It writes `.memory/<sessionId>/` under the current project; `.memory/` is ignored in both the
vault root and this repo.

## Disable, remove, and rollback

Disable resources without uninstalling:

```bash
pi config      # global config UI
pi config -l   # project-local config UI
```

Remove a package from settings and disk:

```bash
pi remove git:github.com/HazAT/pi-interactive-subagents
pi remove git:github.com/amosblomqvist/pi-observational-memory
pi remove npm:pi-subagents
```

Remove a copied local extension/skill by deleting or renaming it under
`/root/.pi/agent/extensions/` or `/root/.pi/agent/skills/`, then run `/reload`.

A settings backup was captured before the 2026-09-01 interactive/memory migration:

```text
/root/.pi/agent/update-tracking/settings-before-interactive-memory-20260901T071922Z.json
```

Restore it with:

```bash
cp /root/.pi/agent/update-tracking/settings-before-interactive-memory-20260901T071922Z.json /root/.pi/agent/settings.json
```

Then remove/rename copied local resources and run `/reload`.

## Updating

Update installed Pi packages with:

```bash
pi update --extensions
```

You can run this from inside an active Pi session. The files on disk update
immediately; the current session may keep already-loaded extension code until
you run `/reload` or restart Pi.

These packages live in the `pi-agent-home` volume, so package updates persist
normally across container restarts and image rebuilds.

### 2026-09-01 update check

A live in-session update was verified:

- `pi-subagents`: `0.58.0` → `0.62.0`
- `pi-web-access`: `0.26.0` → `0.27.0`
- `pi-claude-auth`: already current at `0.1.3`
- `github.com/obra/superpowers`: reconciled at `b36e082`

Credential and runtime checks after `pi update --extensions` and `/reload`:

- `/root/.pi/agent/codex/auth.json` stayed byte-for-byte identical to the
  pre-update backup.
- `/root/.codex/auth.json` still symlinked to
  `/root/.pi/agent/codex/auth.json`.
- `ssh -T git@github.com` still authenticated as `tim003`.
- `subagent({ action: "list" })` still exposed the expected builtin agents.
- `codex-exec` smoke tests passed before update, after update, and after
  `/reload`:
  - `before update codex ok`
  - `after update codex ok`
  - `all extension update codex ok`
  - `fresh reload codex ok`

A backup of the Codex CLI auth file was kept at:

```text
/root/.pi/agent/update-tracking/codex-auth-backup-20260901T034834Z.json
```

Do not commit that backup; it contains credentials. It is only a local recovery
copy on the persistent volume.

### Updating Pi itself

**Updating Pi itself is different in a container.** `pi update --self` writes to
an image layer and is discarded on the next `--rm` exit — it appears to work,
then silently reverts. Rebuild the image instead:

```bash
cd Research/Pi/container
docker build --no-cache -t pi-sandbox -f Dockerfile.pi .
```

See §4b above for why `--no-cache` matters.
