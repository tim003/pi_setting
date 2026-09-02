# Maintenance

Update, rollback, and troubleshooting notes for this Pi setup.

## Update packages

```bash
pi update --extensions
```

Then run `/reload` inside Pi or restart Pi.

`pi update --extensions` only touches installed packages. It never overwrites the local extensions, agents, or skills this repo installs, so nothing needs reapplying afterwards.

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
ANTHROPIC_CLI_VERSION="$(claude --version | awk '{print $1}')" pi auth check --provider anthropic --model claude-haiku-4-5 --json
```

For normal interactive sessions, start Pi with:

```bash
./scripts/pi-with-claude-code-env.sh
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
