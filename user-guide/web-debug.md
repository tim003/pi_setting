# Web Debug Skill

## Purpose

Debug live frontend behavior with browser automation instead of guessing from source alone.

Use this when investigating:

- broken login/auth flows
- 401/403/CORS errors
- JWT/session issues
- form submission failures
- buttons that do nothing
- blank screens/hydration mismatch
- stale frontend data
- works-locally/fails-in-production reports

Skill path:

```text
skills/web-debug/
```

## Usage

Ask Pi to verify a page end-to-end, for example:

```text
Use web-debug to open the local app, try logging in, and inspect console/network errors.
```

The skill will prefer browser tools for DOM, storage, network, console, clicks, forms, and screenshots.

## Caveats

- Do not paste credentials into chat unless explicitly safe. Prefer existing browser/session auth where available.
- For production debugging, inspect server logs/config before repeatedly asking the user to retry the same failing client action.
- Browser state may persist depending on the extension/profile configuration.
