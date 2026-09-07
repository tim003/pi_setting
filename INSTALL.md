# Install Tim's Pi setup on macOS

This guide is for a colleague setting up a similar **host macOS Pi + cmux** environment from this repository. It installs Pi, cmux-aware interactive subagents, local extensions, selected skills, Tailscale/VPS checks, and optional cmux remote access from iOS.

It does **not** copy secrets. You must authenticate with your own Claude, GitHub, OpenAI/Codex, Tailscale, and VPS credentials.

## What you will end up with

- Pi running directly on macOS.
- Pi package-installed extensions and resources configured as first-class parts of this setup:
  - `npm:pi-claude-oauth-adapter` — enabled compatibility adapter for Pi's built-in Anthropic OAuth / Claude Pro/Max sessions
  - `git:github.com/obra/superpowers` — enabled extension plus Superpowers skills
  - `npm:pi-web-access` — enabled extension providing web access tools
  - `git:github.com/amosblomqvist/pi-observational-memory` — enabled memory extension, off by default per session
  - `npm:pi-chrome` — controls the real signed-in Chrome profile; needs a one-time manual Chrome step and per-session authorization
- Local extensions copied into `~/.pi/agent/extensions/`:
  - `ask-user-question`
  - `bash-guard`
  - `browser`
  - `cmux-interactive-subagents` — the active modified cmux interactive subagent provider
  - `host-safety-guard`
  - `parked-issues` — captures side suggestions so they stop derailing the conversation
  - `prompt-snippets`
  - `web-fetch`
- Package skills/prompts:
  - Superpowers skills from `git:github.com/obra/superpowers`:
    - `using-superpowers`
    - `brainstorming`
    - `systematic-debugging`
    - `test-driven-development`
    - `using-git-worktrees`
    - `writing-plans`
    - `executing-plans`
    - `dispatching-parallel-agents`
    - `subagent-driven-development`
    - `requesting-code-review`
    - `receiving-code-review`
    - `verification-before-completion`
    - `finishing-a-development-branch`
    - `writing-skills`
  - `pi-web-access` tools: `web_search`, `fetch_content`, `source_check`, `get_search_content`
  - `web_fetch` comes from the local `web-fetch` extension in this repo, not from `pi-web-access`
- Subagent definitions copied into `~/.pi/agent/agents/`, used by the local cmux provider:
  - `delegate`, `oracle`, `researcher`, `reviewer`, `scout`, `worker`
- Local skills copied into `~/.pi/agent/skills/`:
  - `analyze-sessions`
  - `pdf-reader`
  - `web-debug`
  - `youtube-transcript`
- Optional cmux remote access from iPhone/iPad over Tailscale.

## Where extensions live, and why

This setup has **two** kinds of extensions. Both are required. They are installed in different ways, and that difference is deliberate.

### 1. Package-installed extensions

`pi-claude-oauth-adapter`, `superpowers`, `pi-web-access`, `observational-memory`, and `pi-chrome`.

`pi-chrome` is the one package `scripts/install-packages.sh` cannot fully set up: Chrome requires a human to load the bundled extension via **Load unpacked**. Run `/chrome onboard` afterwards and follow [`docs/OPERATIONS.md`](docs/OPERATIONS.md#chrome-profile-control-pi-chrome). Until that is done, the `chrome_*` tools are present but cannot connect.

These are installed with `pi install ...`, which places them under `~/.pi/agent/npm/` or `~/.pi/agent/git/`. They are activated by the `packages` array in `settings.json`. Step 5 does both: it runs the installer and copies the settings that enable them.

They are **not** copied into this repo's `extensions/` folder. That is not an oversight, and it does not make them optional. The reasons:

- **Pi already loads them from `~/.pi/agent`.** Everything in this repo's `extensions/` gets copied into `~/.pi/agent/extensions/` by the installer, where Pi auto-discovers it. A package copied there too would load twice and register its tools and commands twice.
- **They are third-party code with their own upstream repos and release cadence.** `pi update --extensions` keeps them current. A copy committed here would be a silent fork that drifts out of date and would have to be re-synced by hand after every upstream release.
- **Their trees contain build output, lockfiles, and vendored dependencies** that are noise in a settings repo and make review of *your own* configuration harder.
- **Licensing and attribution stay clean** when the code is fetched from its source rather than re-published here.

So the correct way to capture them in this repo is what this guide does: name them, pin their install commands, record their settings, and document every skill, prompt, and tool they contribute. The install is reproducible without copying their source.

### 2. Local extensions tracked in this repo

`ask-user-question`, `bash-guard`, `browser`, `cmux-interactive-subagents`, `host-safety-guard`, `parked-issues`, `prompt-snippets`, and `web-fetch`.

These live in `extensions/` because they are not installable Pi packages — there is nothing for `pi install` to fetch, so `scripts/install-packages.sh` copies them into `~/.pi/agent/extensions/` instead.

Most of them are not original to this repo. `ask-user-question`, `bash-guard`, `browser`, `prompt-snippets`, and `web-fetch` were copied from [amosblomqvist/pi-config](https://github.com/amosblomqvist/pi-config) and then modified for this setup — that repo is explicitly meant to be cherry-picked from rather than installed wholesale. The four skills in `skills/` come from there unmodified. Only `host-safety-guard`, `cmux-interactive-subagents`, and `parked-issues` originate here.

The practical consequence: this repo is the source of truth for what *you run*, but it is not the origin. When upstream fixes a bug, `pi update` will not bring it in — you have to diff against upstream and port the change by hand. The provenance is recorded in `docs/PROVENANCE.md`.

`cmux-interactive-subagents` is the important one. It is the sole provider of the `subagent`, `subagent_message`, and `subagents_list` tools, and it runs each child in a real cmux terminal pane.

### 3. Subagent definitions in `agents/`

`delegate`, `oracle`, `researcher`, `reviewer`, `scout`, and `worker`.

These are plain Markdown files with YAML frontmatter that define each subagent's role, tools, and thinking level. The installer copies them to `~/.pi/agent/agents/`, which the cmux provider reads directly.

Agent definitions resolve in precedence order, so you can override any of them without editing this repo:

1. `~/.pi/agent/agents/` — global, installed from here
2. `<project>/.pi/agents/` — per-project, wins over global

Model and thinking overrides for these agents live separately, under `subagents.agentOverrides` in `settings.json`.

## Security and scope notes

Pi packages and extensions run with your user permissions and can execute arbitrary code. Review this repo before installing, especially the local `extensions/` directory, and review third-party packages at their upstream sources.

Never copy runtime state or credential-bearing files out of `~/.pi/agent` into this or any other repo. Never commit or share:

- `auth.json`
- `models-store.json`
- `sessions/`
- `npm/`, `git/`, `bin/`
- `ssh/`
- `.env`, tokens, API keys, OAuth credentials, logs, caches, and databases

If you are connecting to the shared VPS, remember it hosts multiple services. Do not restart Caddy, n8n, or unrelated Docker stacks unless you explicitly intend to affect other projects.

## 1. Install macOS prerequisites

Install Command Line Tools if you do not already have them:

```bash
xcode-select --install
```

Install Homebrew if needed: <https://brew.sh/>

Then install common tools:

```bash
brew install node git ripgrep coreutils ffmpeg yt-dlp tailscale
```

Install the standalone Tailscale macOS app from Tailscale if you need the GUI and CLI together:

<https://tailscale.com/download/macos>

The App Store Tailscale build can be sandboxed and may not expose the CLI in the way cmux remote tooling expects.

## 2. Install cmux

Install cmux from its official source:

<https://cmux.com/>

Open cmux once and create a normal terminal pane. Later, start Pi from inside cmux when you want interactive subagents; the local subagent provider needs direct cmux access via `CMUX_SOCKET_PATH`.

Quick check from a cmux terminal:

```bash
echo "$CMUX_SOCKET_PATH"
command -v cmux
```

`CMUX_SOCKET_PATH` should be non-empty inside a cmux-managed terminal.

## 3. Install Pi

Install Pi globally with npm:

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

If you use `nvm`, install Pi under the Node version you actually use in your shell, and make sure `pi` is on `PATH` inside cmux.

## 4. Clone this settings repo

Clone the GitHub repo that contains this `pi_setting` directory:

```bash
git clone git@github.com:tim003/pi_setting.git ~/pi_setting
cd ~/pi_setting

# If you prefer HTTPS:
# git clone https://github.com/tim003/pi_setting.git ~/pi_setting
```

## 5. Install package sources, local extensions, agents, and skills

Run the bundled installer:

```bash
./scripts/install-packages.sh
```

This installs third-party Pi packages, copies local extensions, subagent definitions, and skills into `~/.pi/agent`, installs extension dependencies, and creates `~/Desktop/pi-inbox` for safe image/screenshot reads.

Then copy the example settings, or merge them if you already have Pi settings:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR"
cp settings/settings.example.json "$PI_DIR/settings.json"
cp settings/web-search.example.json "$PI_DIR/web-search.json"
```

Verify the installed agent definitions:

```bash
ls ~/.pi/agent/agents/
# delegate.md  oracle.md  researcher.md  reviewer.md  scout.md  worker.md
```

## 6. Authenticate locally

### Anthropic OAuth / Claude Pro/Max

Pi has built-in Anthropic OAuth. `pi-claude-oauth-adapter` is the compatibility layer for Claude Pro/Max sessions: it adds the required OAuth billing header and adapts Pi's prompt handling. Inside Pi, run `/login`, choose **Claude Pro/Max**, select an Anthropic model in `/model`, and use Pi normally.

Smoke test:

```bash
pi auth check --provider anthropic --model claude-haiku-4-5 --json
```

If that fails, repeat the Pi `/login` flow and confirm the selected provider is `anthropic` before debugging the adapter.

### GitHub SSH

Use your own GitHub SSH key. Do not copy Tim's key or any `~/.pi/agent/ssh` contents.

```bash
ssh -T git@github.com
```

Expected shape:

```text
Hi <your-github-user>! You've successfully authenticated, but GitHub does not provide shell access.
```

### Optional Codex CLI

Pi's `openai-codex` provider login and the `codex` CLI login are separate. If you want CLI-backed Codex subagents, see [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md#auth-checks).

## 7. Start Pi and reload resources

Start Pi from a cmux terminal:

```bash
cd ~/pi_setting
pi
```

Normal `pi` startup loads the installed `pi-claude-oauth-adapter` package from `settings.json`.

Inside Pi, run:

```text
/reload
```

Basic checks from a shell:

```bash
pi list
pi --list-models | grep -E 'claude|openai-codex' | head
```

Inside Pi, ask for a simple command or use the tools normally. You should see local skills loaded in the prompt context when relevant.

### Guard prompt defaults

This setup is meant to be usable without excessive confirmations:

- `host-safety-guard` defaults to `high-only`. High-risk credential paths prompt for approval rather than being refused outright, and the prompt warns you when approving would record file contents or command output into the session transcript. With no UI available it fails closed and refuses. Keep it that way unless you want stricter Desktop/path prompts. To force strict mode, start Pi with `PI_HOST_GUARD_LEVEL=strict`; to return to the default, unset that variable or run `/host-guard high-only` inside Pi.

  To stop the prompts while diagnosing SSH or cloud config, run `/host-guard off` (or start with `pi --host-guard-disabled` / `PI_HOST_GUARD_LEVEL=off`). This releases non-secret config files such as `~/.ssh/config`, `known_hosts`, and `*.pub`, but a secrets floor still prompts for private keys, keychains, `~/.secrets`, `~/.aws/credentials`, `~/.kube/config`, and 1Password data — a leaked credential cannot be unwritten from the session transcript. A red `⚠ HOST GUARD OFF` badge marks the status line while it is off. See [docs/OPERATIONS.md](docs/OPERATIONS.md#guard-defaults) for the full table.
- `bash-guard` also defaults to high-only. Medium-risk commands, including routine git commands, are auto-allowed, and only high-risk commands prompt. To restore prompting on medium-risk commands, start Pi with `PI_BASH_GUARD_LEVEL=strict`. To silence interactive prompting entirely for one session, run `/bash-guard` inside Pi. Catastrophic commands stay hard-blocked in every mode.

## 8. Verify modified cmux interactive subagents

Step 5 already installed `extensions/cmux-interactive-subagents/` and the agent definitions, so there is nothing extra to activate. Confirm the runtime requirements:

- `cmux` is on `PATH`.
- `CMUX_SOCKET_PATH` is set.
- Pi was started from inside cmux, or at least your shell has cmux socket access.

Restart Pi or run `/reload`, then verify with the Pi tools:

```text
subagents_list
```

Launch smoke test:

```text
Use the subagent tool to start a delegate named cmux-smoke-test with this task: Say exactly: cmux custom subagent ok
```

Resume smoke test:

```text
Send cmux-smoke-test this message: Say exactly: cmux resume ok
```

Expected: a cmux child pane appears, completes, and can be resumed by name.

If this fails:

1. Confirm `echo "$CMUX_SOCKET_PATH"` is non-empty in the shell that launched Pi.
2. Confirm `ls ~/.pi/agent/agents/` lists the six agent definitions; `subagents_list` is empty without them.
3. Run `/reload` or restart Pi.
4. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md#cmux-interactive-subagents) and [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md#cmux-subagent-troubleshooting).

## 9. Observational memory

Observational memory is installed but gated off by default.

Inside Pi:

```text
/om:status
/om on
/om off
```

It writes `.memory/<sessionId>/` under the current project. Add `.memory/` to project `.gitignore` before using it in a repository that does not already ignore it.

Current config in `settings/settings.example.json` uses:

- observer: `anthropic/claude-haiku-4-5`, low thinking
- consolidator: `anthropic/claude-sonnet-4-6`, medium thinking
- passive mode: off

## 10. Tailscale and shared VPS access

If you already have VPS access through Tailscale, verify it before wiring it into any Pi workflow.

On the Mac:

```bash
tailscale status
tailscale ip -4
```

Find the VPS tailnet IP and hostname in `tailscale status`, and use those values. Do not hardcode a host or address from someone else's notes — tailnet IPs change when a machine is re-registered.

Test SSH with your own VPS username/key:

```bash
ssh <user>@<vps-tailnet-ip> 'hostname; whoami'
```

If this fails, fix Tailscale/VPS SSH outside Pi first. Do not assume this settings repo grants VPS access; it does not include private keys.

Operational caution for the shared VPS:

- Several projects share one Caddy instance.
- A deploy/restart for one project must not disturb others.
- Check server-side logs/config before repeated client-side testing.
- Do not run broad commands such as `docker compose down` from a shared directory.

## 11. Optional: cmux remote access from iOS over Tailscale

This section mirrors Tim's setup using the third-party **Cmux Remote** app and relay. Treat it as optional and security-sensitive.

### Security tradeoff

Cmux Remote mirrors real cmux panes and sends keyboard input. That means it is effectively remote terminal control.

The relay also requires:

```bash
CMUX_SOCKET_MODE=allowAll
```

That lets processes outside cmux connect to cmux's socket. On a single-user Mac this may be acceptable; on a shared or high-risk machine, think carefully before enabling it.

### 11.1 Confirm Tailscale on Mac and iPhone

- Install Tailscale on macOS and sign in.
- Install Tailscale on iOS and sign in to the same tailnet or an account with access.
- iOS can run only one VPN at a time; turn off other VPNs while using Tailscale.

Get the Mac tailnet IP:

```bash
tailscale ip -4
```

Use this IP in the relay config below.

### 11.2 Build and install the relay

cmux must be running.

```bash
git clone https://github.com/NewTurn2017/cmux-remote.git ~/cmux-remote
cd ~/cmux-remote
./scripts/install-launchd.sh
```

This installs the relay under `~/.cmuxremote/` and creates a LaunchAgent named `com.genie.cmuxremote`.

### 11.3 Bind the relay to the tailnet IP only

Do not leave the relay on `0.0.0.0` unless you intentionally want LAN exposure.

Replace `<mac-tailnet-ip>` with your Mac's Tailscale IP:

```bash
cp ~/.cmuxremote/relay.json ~/.cmuxremote/relay.json.bak

cat > ~/.cmuxremote/relay.json <<'EOF'
{
  "listen": "<mac-tailnet-ip>:4399",
  "default_fps": 15,
  "idle_fps": 5
}
EOF

launchctl kickstart -k "gui/$(id -u)/com.genie.cmuxremote"
lsof -nP -iTCP:4399 -sTCP:LISTEN
```

Expected: the listener is bound to `<mac-tailnet-ip>:4399`, not `*:4399`.

### 11.4 Open cmux's socket to the relay

One-time/manual for the current login session:

```bash
launchctl setenv CMUX_SOCKET_MODE allowAll
```

Then quit and relaunch cmux, and restart the relay:

```bash
launchctl kickstart -k "gui/$(id -u)/com.genie.cmuxremote"
```

If you want this to persist across Mac restarts, create a small LaunchAgent. This is convenient but keeps the cmux socket open to local processes across logins.

```bash
mkdir -p ~/bin ~/Library/LaunchAgents

cat > ~/bin/cmux-socket-mode <<'EOF'
#!/bin/sh
launchctl setenv CMUX_SOCKET_MODE allowAll
EOF
chmod +x ~/bin/cmux-socket-mode

cat > ~/Library/LaunchAgents/com.tim.cmuxsocketmode.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tim.cmuxsocketmode</string>
  <key>ProgramArguments</key>
  <array>
    <string>$HOME/bin/cmux-socket-mode</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.tim.cmuxsocketmode.plist
launchctl kickstart "gui/$(id -u)/com.tim.cmuxsocketmode"
launchctl getenv CMUX_SOCKET_MODE
```

Expected:

```text
allowAll
```

If cmux starts before this LaunchAgent after a reboot, quit and relaunch cmux once.

### 11.5 Pair iOS

1. Turn on Tailscale on iPhone/iPad.
2. Open the Cmux Remote iOS app.
3. Add a Mac using the Mac tailnet IP and port `4399`.
4. Approve pairing from the relay's macOS menu bar icon.

Pairing is per device. Revoke a lost device from the relay menu bar.

### 11.6 Verify and operate the relay

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN
tail -n 50 ~/.cmuxremote/log/stderr.log
cd ~/cmux-remote && ./scripts/cmux-probe.sh
```

Useful operations:

```bash
SERVICE="gui/$(id -u)/com.genie.cmuxremote"
launchctl kickstart -k "$SERVICE"
launchctl print "$SERVICE" | grep -E 'state|pid|last exit'
launchctl bootout "$SERVICE"
tail -f ~/.cmuxremote/log/stderr.log
```

Common symptoms:

- `socketMissing(...)`: cmux is not running. Launch cmux and restart the relay.
- `attached` / `detached` loop: socket mode is wrong or cmux started before `CMUX_SOCKET_MODE=allowAll` was set. Check `launchctl getenv CMUX_SOCKET_MODE`, relaunch cmux, then restart the relay.
- Relay listens on `*:4399`: fix `~/.cmuxremote/relay.json` to bind to the tailnet IP.

## 12. Update and rollback

Update Pi packages:

```bash
pi update --extensions
```

Then run `/reload` or restart Pi so the updated package code is loaded.

Update Pi itself:

```bash
pi update --self
pi --version
```

Rollback local extensions, agents, or skills by removing or renaming their folders under `~/.pi/agent/extensions/`, `~/.pi/agent/agents/`, or `~/.pi/agent/skills/`, then run `/reload`. Re-running `./scripts/install-packages.sh` restores them from this repo.

Before changing settings, snapshot them so you can restore by hand:

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR/update-tracking"
cp "$PI_DIR/settings.json" \
   "$PI_DIR/update-tracking/settings-$(date -u +%Y%m%dT%H%M%SZ).json"
```

## 13. Final checklist

Run these before calling the setup complete:

```bash
pi --version
pi list
pi --list-models | grep claude | head
ssh -T git@github.com
claude --version
pi auth check --provider anthropic --model claude-haiku-4-5 --json
```

From a cmux terminal:

```bash
echo "$CMUX_SOCKET_PATH"
ls ~/.pi/agent/agents/
```

Inside Pi:

```text
/reload
/om:status
```

Then verify one cmux subagent launch and resume as described in section 8.

For iOS remote access, also verify:

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN
launchctl getenv CMUX_SOCKET_MODE
tail -n 50 ~/.cmuxremote/log/stderr.log
```

The relay should listen on the Mac tailnet IP only, cmux socket mode should be `allowAll`, and the log should not show a repeated attach/detach loop.
