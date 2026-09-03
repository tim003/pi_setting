import { spawnSync } from "node:child_process";

export type AvailableModel = { provider: string; id: string };
export type ModelCheck = { ok: true } | { ok: false; error: string };

/**
 * `pi --list-models` prints only the models whose provider actually has
 * usable auth — stored credentials or an API key in the environment. That
 * makes it the authoritative answer to "can a child use this model?", which
 * is why we ask Pi instead of re-deriving auth from auth.json here.
 */
export function parseAvailableModels(stdout: string): AvailableModel[] {
  const models: AvailableModel[] = [];
  for (const line of stdout.split("\n")) {
    const columns = line.trim().split(/\s{2,}|\t+/).filter(Boolean);
    if (columns.length < 2) continue;
    const [provider, id] = columns;
    // The table header, and any warning a loaded extension printed first.
    if (provider === "provider" && id === "model") continue;
    if (/[\s:]/.test(provider) || provider.endsWith(":")) continue;
    models.push({ provider, id });
  }
  return models;
}

/**
 * Guards the one failure this extension cannot recover from: a child launched
 * against a provider with no credentials dies during startup, before any agent
 * turn, so the child helper never fires and never writes its exit sidecar. The
 * tab then hangs as "running" forever. Refusing the launch costs a tool error;
 * allowing it costs an orphan tab and a wedged parent.
 */
export function checkModelSelection(
  model: string | undefined,
  available: readonly AvailableModel[] | undefined,
): ModelCheck {
  const raw = typeof model === "string" ? model.trim() : "";
  // No override at all is fine: the child inherits the parent's working model.
  if (!raw) return { ok: true };

  const slash = raw.indexOf("/");
  // A thinking level may ride along as `provider/id:high`.
  const withoutThinking = raw.slice(slash + 1).split(":")[0];

  // An empty list means we could not ask, not that nothing is permitted.
  const known = available && available.length > 0 ? available : undefined;

  if (slash <= 0) {
    const bare = raw.split(":")[0];
    const matches = known?.filter((m) => m.id === bare) ?? [];
    const suggestion =
      matches.length > 0
        ? ` Did you mean ${matches.map((m) => `${m.provider}/${bare}`).join(" or ")}?`
        : "";
    return {
      ok: false,
      error:
        `Model override "${raw}" is not provider-qualified. Use provider/model, ` +
        `because a bare name can resolve to a provider with no credentials, and such a child ` +
        `dies before its first turn and leaves a tab stuck as running.${suggestion}`,
    };
  }

  if (!known) return { ok: true };

  const provider = raw.slice(0, slash);
  const providers = [...new Set(known.map((m) => m.provider))];
  if (!providers.includes(provider)) {
    return {
      ok: false,
      error:
        `No usable credentials for provider "${provider}", so a child on it would die at startup. ` +
        `Authenticated providers: ${providers.join(", ")}.`,
    };
  }

  if (!known.some((m) => m.provider === provider && m.id === withoutThinking)) {
    const ids = known.filter((m) => m.provider === provider).map((m) => m.id);
    return {
      ok: false,
      error: `Unknown model "${withoutThinking}" for provider "${provider}". Available: ${ids.join(", ")}.`,
    };
  }

  return { ok: true };
}

let cache: { at: number; models: AvailableModel[] } | undefined;
const CACHE_MS = 60_000;

/**
 * Returns undefined when Pi could not be asked. Callers treat that as "check
 * what you can" rather than "block everything", so a broken lookup degrades to
 * the structural rule instead of disabling subagents entirely.
 */
export function availableModels(now: number = Date.now()): AvailableModel[] | undefined {
  if (cache && now - cache.at < CACHE_MS) return cache.models;
  try {
    const result = spawnSync("pi", ["--list-models"], { encoding: "utf8", timeout: 20_000 });
    if (result.error || result.status !== 0 || !result.stdout) return undefined;
    const models = parseAvailableModels(result.stdout);
    if (models.length === 0) return undefined;
    cache = { at: now, models };
    return models;
  } catch {
    return undefined;
  }
}
