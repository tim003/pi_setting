# Maintenance

Update, rollback, and troubleshooting notes for this Pi setup.

## Update packages

```bash
pi update --extensions
./scripts/patch-pi-claude-auth-cli-version.sh
./scripts/reapply-om-local-fixes.sh
```

Then run `/reload` inside Pi or restart Pi.

`pi update --extensions` touches installed packages and can overwrite the local `pi-claude-auth` CLI-version patch. Re-run the patch script afterwards. It does not overwrite the local extensions, agents, or skills this repo installs.

Git-installed packages are updated with `git reset --hard @{upstream}`, which discards local commits. `pi-observational-memory` carries two — see [local package fixes](#local-package-fixes) — so re-run its script too. Both scripts are idempotent and safe to run when nothing needs doing.

## Local package fixes

`pi-observational-memory` carries two fixes that are not upstream. Each lives on its own local branch, with a patch file as the durable copy, and they are applied in the order below because each was cut on top of the one before it.

| fix | branch | patch | why |
| --- | --- | --- | --- |
| Observer coverage spans | `fix/observer-coverage-gap` | `patches/om-observer-coverage-gap.patch` | Coverage is tracked as spans so a failed observer's slice is retried instead of being buried by a later observer's committed watermark. Without it, a killed observer silently loses that stretch of conversation from memory, permanently. |
| NUL bytes in worker argv | `fix/observer-argv-null-bytes` | `patches/om-argv-null-bytes.patch` | The kickoff prompt embeds a transcript chunk verbatim and reaches the worker as an argv element. Any recorded command that touched binary data can leave a NUL byte in that chunk, and Node refuses NUL in argv, so `spawn()` throws `The argument 'args[15]' must be a string without null bytes` before the worker starts. The observer then fails on every trigger until the chunk ages out. |

```bash
./scripts/reapply-om-local-fixes.sh
```

The script replays each branch onto the new upstream tip, and rebuilds a branch from its patch when the clone is fresh and has no such branch. It refuses to run over an uncommitted working tree rather than stashing someone's work, and aborts cleanly if upstream has changed enough that the fix no longer applies — at which point check whether upstream fixed it properly, and drop the patch if so.

After changing a fix, refresh its patch so the repo stays the source of truth:

```bash
cd ~/.pi/agent/git/github.com/amosblomqvist/pi-observational-memory
git format-patch -1 fix/observer-coverage-gap --stdout \
  > ~/Documents/Obsidian_note/Pi/pi_setting/patches/om-observer-coverage-gap.patch
git format-patch -1 fix/observer-argv-null-bytes --stdout \
  > ~/Documents/Obsidian_note/Pi/pi_setting/patches/om-argv-null-bytes.patch
```

## Update Pi itself

For the host macOS setup:

```bash
pi update --self
pi --version
```

If Pi was installed through a specific `nvm` Node version, make sure your shell and cmux panes use that same Node/npm environment.

## Reinstall local resources

From this repo:

```bash
./scripts/install-packages.sh
cp settings/settings.example.json "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/settings.json"
cp settings/web-search.example.json "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/web-search.json"
```

Then run `/reload`.

## Clean generated dependencies

This repo intentionally does not track extension `node_modules/`. If the checkout gets large, clean ignored generated folders:

```bash
find extensions -type d -name node_modules -prune -exec rm -rf {} +
```

Recreate them with:

```bash
./scripts/install-packages.sh
```

## Auth checks

Claude Code / Anthropic:

```bash
claude --version
claude auth login --claudeai
./scripts/patch-pi-claude-auth-cli-version.sh
pi auth check --provider anthropic --model claude-haiku-4-5 --json
```

GitHub SSH:

```bash
ssh -T git@github.com
```

### GitHub SSH keys live in 1Password

The key is held by **1Password's SSH agent**, not the launchd default agent and not a file on disk. Diagnose in this order before changing anything.

**Never run `ssh-add` on this machine.** It would extract the private key out of 1Password onto disk and into a second agent, defeating the reason it is in 1Password. There is no situation in this setup where `ssh-add` is the fix.

Symptom — `git push` fails with:

```
Permissions 0644 for '~/.ssh/<key>.pub' are too open
Load key "~/.ssh/<key>.pub": bad permissions
git@github.com: Permission denied (publickey)
```

This is misleading in two ways. `0644` is *correct* for a public key, and the permissions are not the problem. 1Password's config lists the **public** key as `IdentityFile` alongside an `IdentityAgent` socket; when the agent does not answer, ssh falls back to parsing that `.pub` as a private key and reports the confusing error above. **It means the agent is unreachable.**

Ask the agent directly:

```bash
SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock" ssh-add -l
```

| Result | Meaning | Fix |
| --- | --- | --- |
| Lists keys incl. `GitHub (ED25519)` | Agent healthy and unlocked | Look elsewhere — remote URL, network, repo permissions |
| `Error connecting to agent: Connection refused` | 1Password has **quit**; socket file remains with no listener | `pgrep -fl 1Password`, then `open -a "1Password"` |
| Connects but no identities, or prompts | Vault **locked**, or SSH agent disabled in settings | Unlock 1Password; check Settings → Developer → Use the SSH agent |

Do not read `SSH_AUTH_SOCK` as authoritative. It usually points at `/private/tmp/com.apple.launchd.*/Listeners` even when ssh is correctly routed to 1Password via `IdentityAgent` in `~/.ssh/config`. Read the config rather than inferring the agent from the environment.

If pushes worked earlier in the same session and then stopped, the overwhelmingly likely cause is 1Password quitting — not a key, config, or permissions change. Establish what changed before proposing anything that adds a credential.

Codex CLI, if used:

```bash
export CODEX_HOME="$HOME/.pi/agent/codex"
codex login --device-auth
codex login status
```

Pi OpenAI/Codex provider auth is separate from the external `codex` CLI login.

## cmux subagent troubleshooting

Symptom: no child pane or subagent launch fails.

Check:

```bash
echo "$CMUX_SOCKET_PATH"
command -v cmux
```

Symptom: `subagents_list` returns nothing.

The provider reads agent definitions from `~/.pi/agent/agents/`. Confirm they are present, and reinstall them from this repo if not:

```bash
ls ~/.pi/agent/agents/
./scripts/install-packages.sh
```

Then `/reload` or restart Pi.

## cmux remote relay troubleshooting

Check listener:

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN
```

Expected: bound to the Mac Tailscale IP, not `*:4399`.

Check socket mode:

```bash
launchctl getenv CMUX_SOCKET_MODE
```

Expected, if using Cmux Remote relay:

```text
allowAll
```

Check logs:

```bash
tail -n 50 ~/.cmuxremote/log/stderr.log
```

Common symptoms:

- `socketMissing(...)`: cmux is not running.
- repeated attach/detach: relaunch cmux after setting `CMUX_SOCKET_MODE=allowAll`, then restart the relay.
- listener on `*:4399`: bind `~/.cmuxremote/relay.json` to the Mac tailnet IP.

## Rollback

Activation scripts write settings backups under:

```text
~/.pi/agent/update-tracking/
```

Rollback the cmux subagent provider:

```bash
rm -rf ~/.pi/agent/extensions/cmux-interactive-subagents
# restore a saved settings.json from ~/.pi/agent/update-tracking/ if needed
# then run /reload inside Pi
```

Disable resources without uninstalling:

```bash
pi config
pi config -l
```

Remove packages only when you no longer need them:

```bash
pi remove git:github.com/amosblomqvist/pi-observational-memory
```

The cmux subagent provider is self-contained: it reads its agent definitions from `~/.pi/agent/agents/` and needs no subagent package installed.
