# Host Safety Guard

## Purpose

`host-safety-guard` is a local runtime guard for host Pi. It adds a tool-call safety layer around high-risk host paths now that Pi runs directly on macOS instead of inside Docker.

## Current status

Installed live 2026-09-01:

```text
~/.pi/agent/extensions/host-safety-guard/
```

Source path in this repo:

```text
extensions/host-safety-guard/
```

Unit tests cover Desktop/pi-inbox access, secret-looking filenames, protected credential paths, bash commands that mention protected paths, guard modes, and remembered approvals.

## Prompting level

The guard has two modes. Default is `high-only`, which prompts only for high-risk findings and silently allows medium-risk ones.

```text
/host-guard             # show current mode
/host-guard strict      # also confirm medium-risk access
/host-guard high-only   # default: prompt only for high risk
```

Startup override:

```bash
PI_HOST_GUARD_LEVEL=strict
PI_HOST_GUARD_LEVEL=high-only
```

Changing mode clears remembered approvals for the session.

## Risk tiers

**High risk — always blocked, in every mode**

- protected credential directories
- secret-looking path names
- bash commands referencing protected credential paths

**Medium risk — confirmed only in `strict` mode**

- non-image files in `~/Desktop/pi-inbox/`
- Desktop paths outside `~/Desktop/pi-inbox/`
- bash commands that merely mention Desktop

In `strict` mode, approving a path is remembered for the rest of the session so the same path is not re-prompted.

## Rules

- Allows `read` access to image files in:

  ```text
  ~/Desktop/pi-inbox/
  ```

- Medium-risk access (confirmed in `strict`, allowed in `high-only`):
  - non-image files in `~/Desktop/pi-inbox/`
  - Desktop paths outside `~/Desktop/pi-inbox/`
  - bash commands that mention Desktop paths

- Blocks access to credential/high-risk host paths, including:
  - `~/.ssh/`
  - `~/.gnupg/`
  - `~/.aws/`
  - `~/.kube/`
  - `~/.docker/`
  - `~/.secrets/`
  - `~/Library/Keychains/`
  - `~/Library/Application Support/1Password/`

- Blocks paths whose names look secret-bearing, such as `token`, `credentials`, `password`, `private-key`, or `.env`.

## Screenshot workflow

1. Save or drag screenshots into:

   ```text
   ~/Desktop/pi-inbox/
   ```

2. Ask Pi to inspect the image path. Image formats allowed for direct reads include PNG, JPG/JPEG, WEBP, GIF, HEIC, BMP, and TIFF.

3. Do not put secrets, credentials, keys, or private files in this folder.

## Verify

```bash
cd ~/.pi/agent/extensions/host-safety-guard
npm test
```

Expected result: 10 passing tests.

Run `/reload` or restart Pi after changing extension code.
