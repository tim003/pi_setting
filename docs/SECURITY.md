# Security notes

Pi extensions and skills run with your local user permissions. Treat this repository like executable code, not just settings.

## Do not commit secrets

Never commit or share these from `~/.pi/agent`:

- `auth.json`
- `models-store.json`
- `sessions/`
- `npm/`, `git/`, `bin/`
- `ssh/`
- `.memory/`
- `.env`, tokens, API keys, OAuth credentials, logs, caches, databases

Use your own Claude, GitHub, OpenAI/Codex, Tailscale, and VPS credentials.

## Host Pi scope

This setup runs Pi directly on macOS. That makes it convenient for cmux and local project work, but also means Pi can access files your macOS user can access unless an extension blocks them.

The `host-safety-guard` extension provides guardrails, but it is not a sandbox. Do not rely on it as a hard security boundary.

## GitHub SSH

Use your own GitHub SSH key. This repo does not include private keys.

A normal GitHub SSH test is:

```bash
ssh -T git@github.com
```

Any key you make available to Pi has the same repository access it has for you.

## Claude Code / pi-claude-auth

`pi-claude-auth` uses local Claude Code OAuth credentials. Keep Claude Code authenticated with your own account:

```bash
claude auth login --claudeai
```

Claude Code auto-updates independently from `pi-claude-auth`. Start Pi through `scripts/pi-with-claude-code-env.sh` so `ANTHROPIC_CLI_VERSION` is derived from `claude --version`; this keeps the Claude Code user-agent and billing header aligned without editing package files.

If a Claude Code update changes auth or billing behavior, verify with a small Anthropic model before doing expensive work.

## Tailscale and VPS

Tailscale access is not granted by this repo. Verify your own tailnet/VPS access:

```bash
tailscale status
ssh <user>@<vps-tailnet-ip> 'hostname; whoami'
```

The shared VPS may host multiple services behind one Caddy instance. Avoid broad Docker or Caddy commands unless you intend to affect every service.

## Cmux Remote risk

Cmux Remote mirrors terminal panes and sends keyboard input. It is remote terminal control.

The third-party relay flow requires:

```bash
launchctl setenv CMUX_SOCKET_MODE allowAll
```

That opens cmux's socket to local processes outside cmux. On a single-user Mac this may be acceptable. On a shared or high-risk Mac, prefer not to enable persistent `allowAll`.

If using the relay, bind it to the Mac tailnet IP only:

```json
{
  "listen": "<mac-tailnet-ip>:4399"
}
```

Do not leave it bound to `0.0.0.0:4399` unless you intentionally want LAN exposure.

Revoke lost iOS devices from the relay's macOS menu bar icon.
