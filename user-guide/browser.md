# Browser Extension

## Purpose

The `browser` extension from `amosblomqvist/pi-config` gives Pi Playwright-driven browser tools for live frontend debugging.

Tools include navigation, DOM evaluation, console/network inspection, form fill/clicks, screenshots, and browser close.

## Current status

Installed live 2026-09-01:

```text
~/.pi/agent/extensions/browser/
```

Source path in this repo:

```text
extensions/browser/
```

Chromium was installed with Playwright under the macOS Playwright cache.

## Opt-in behavior

Browser tools are disabled by default. Enable them only when needed:

```text
/browser on
```

Check status:

```text
/browser status
```

Turn off/close when finished:

```text
/browser off
/browser close
```

## Environment knobs

```bash
PI_BROWSER_HEADFUL=1
PI_BROWSER_PROFILE=~/.pi/agent/extensions/browser/.profile
```

Use headful mode only when debugging the browser extension itself or when visual interaction matters.

## Security notes

- Browser sessions can retain cookies/localStorage in the configured profile.
- Avoid entering sensitive credentials unless the target and workflow are trusted.
- Prefer test accounts for production debugging.
- Use the `web-debug` skill when investigating live frontend behavior.

## Reinstall

```bash
cd ~/.pi/agent/extensions/browser
npm install --omit=dev
npx playwright install chromium
```

Then run `/reload` or restart Pi.
