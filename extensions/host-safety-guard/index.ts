import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type GuardMode = "high-only" | "strict" | "off";
export type RiskLevel = "none" | "medium" | "high";

type Decision =
  | { action: "allow"; risk: RiskLevel; reason: string }
  | { action: "confirm"; risk: RiskLevel; reason: string; recordsContents?: boolean }
  | { action: "block"; risk: RiskLevel; reason: string };

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".bmp", ".tiff", ".tif"]);
const SECRET_NAME_RE = /(^|[._\-\s/])(secret|secrets|password|passwd|credential|credentials|private[-_ ]?key|token|keychain|\.env)([._\-\s/]|$)/i;

function normalizePath(path: string, home = homedir()): string {
  const expanded = path === "~" ? home : path.startsWith(`~${sep}`) ? `${home}${path.slice(1)}` : path;
  return resolve(expanded);
}

function isWithin(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}${sep}`);
}

function extensionOf(path: string): string {
  const match = path.toLowerCase().match(/\.[^.\/]+$/);
  return match ? match[0] : "";
}

export function resolveMode(env: Record<string, string | undefined> = process.env): GuardMode {
  const raw = String(env.PI_HOST_GUARD_LEVEL ?? "").trim().toLowerCase();
  if (raw === "strict") return "strict";
  if (raw === "off" || raw === "disabled") return "off";
  return "high-only";
}

/**
 * The floor for `off` mode, expressed as what may be *released* rather than what is
 * withheld: an allowlist fails safe when an unfamiliar file appears in a protected
 * directory, whereas a blocklist silently lets it through.
 *
 * Everything here is non-secret by design — host aliases, agent settings, public
 * keys. Note `.aws/config` is releasable while `.kube/config` is not: the former
 * holds region and role names, the latter embeds bearer tokens and client certs.
 */
const OFF_MODE_RELEASABLE = [
  /^\.ssh\/config$/,
  /^\.ssh\/config\.d\/[^/]+$/,
  /^\.ssh\/known_hosts(\.old)?$/,
  /^\.ssh\/authorized_keys$/,
  /^\.ssh\/[^/]+\.pub$/,
  /^\.aws\/config$/,
  /^\.gnupg\/(gpg\.conf|gpg-agent\.conf|dirmngr\.conf)$/,
];

/** True when `target` is a known-harmless file that `off` mode may stop prompting for. */
export function isReleasableInOffMode(target: string, home = homedir()): boolean {
  if (!isWithin(target, home)) return false;
  const relative = target.slice(home.length + 1).split(sep).join("/");
  // A secret-looking name overrides the allowlist: ~/.ssh/private-key.pub stays guarded.
  if (SECRET_NAME_RE.test(relative)) return false;
  return OFF_MODE_RELEASABLE.some((pattern) => pattern.test(relative));
}

/** Medium-risk findings prompt only in strict mode; high-risk always prompts. */
function applyMode(decision: Decision, mode: GuardMode): Decision {
  if (decision.action === "confirm" && decision.risk === "medium" && mode !== "strict") {
    return { action: "allow", risk: decision.risk, reason: `${decision.reason} (auto-allowed in high-only mode)` };
  }
  return decision;
}

export function isApproved(approvals: Set<string>, path: string, home = homedir()): boolean {
  return approvals.has(normalizePath(path, home));
}

export function recordApproval(approvals: Set<string>, path: string, home = homedir()): void {
  approvals.add(normalizePath(path, home));
}

export function analyzePathAccess(
  path: string,
  operation: string,
  home = homedir(),
  mode: GuardMode = resolveMode(),
): Decision {
  const target = normalizePath(path, home);
  const protectedDirs = [
    ".ssh",
    ".gnupg",
    ".aws",
    ".config/gcloud",
    ".kube",
    ".docker",
    ".secrets",
    "Library/Keychains",
    "Library/Application Support/1Password",
  ].map((p) => normalizePath(`${home}/${p}`, home));
  const desktop = normalizePath(`${home}/Desktop`, home);
  const inbox = normalizePath(`${home}/Desktop/pi-inbox`, home);

  // High-risk findings ask rather than refuse: this is the user's own machine and
  // they are present to judge. Reads additionally warn, because approving one writes
  // the file's contents into the session transcript permanently.
  if (SECRET_NAME_RE.test(target)) {
    return {
      action: "confirm",
      risk: "high",
      reason: `${operation}: path name looks secret-bearing (${path})`,
      recordsContents: operation === "read",
    };
  }

  for (const dir of protectedDirs) {
    if (isWithin(target, dir)) {
      if (mode === "off" && isReleasableInOffMode(target, home)) {
        return { action: "allow", risk: "none", reason: `Released in off mode: ${path}` };
      }
      return {
        action: "confirm",
        risk: "high",
        reason: `${operation}: protected host path (${path})`,
        recordsContents: operation === "read",
      };
    }
  }

  if (isWithin(target, inbox)) {
    if (IMAGE_EXTENSIONS.has(extensionOf(target)) && operation === "read") {
      return { action: "allow", risk: "none", reason: "Allowed read of image in ~/Desktop/pi-inbox" };
    }
    return applyMode(
      {
        action: "confirm",
        risk: "medium",
        reason: `${operation} in ~/Desktop/pi-inbox is not an image read`,
      },
      mode,
    );
  }

  if (isWithin(target, desktop)) {
    return applyMode(
      {
        action: "confirm",
        risk: "medium",
        reason: `${operation} on Desktop outside ~/Desktop/pi-inbox`,
      },
      mode,
    );
  }

  return { action: "allow", risk: "none", reason: "No host-safety path rule matched" };
}

function shellMentionsProtectedPath(command: string, home: string, mode: GuardMode): Decision | null {
  const compact = command.replace(/\\ /g, " ");
  const protectedPatterns = [
    "~/.ssh", `${home}/.ssh`,
    "~/.gnupg", `${home}/.gnupg`,
    "~/.aws", `${home}/.aws`,
    "~/Library/Keychains", `${home}/Library/Keychains`,
    "~/.secrets", `${home}/.secrets`,
  ];
  if (protectedPatterns.some((pattern) => compact.includes(pattern))) {
    // In off mode a command is released only when every protected path it names is
    // releasable. `cat ~/.ssh/config ~/.ssh/id_rsa` therefore still prompts.
    if (mode === "off") {
      const touching = compact
        .split(/\s+/)
        .map((token) => token.replace(/^["']|["']$/g, ""))
        .filter((token) => protectedPatterns.some((pattern) => token.includes(pattern)));
      const allReleasable =
        touching.length > 0 &&
        touching.every((token) => isReleasableInOffMode(normalizePath(token, home), home));
      if (allReleasable) return null;
    }
    // Command output is captured in the transcript, so approval always has a persistent cost.
    return {
      action: "confirm",
      risk: "high",
      reason: "bash: command references protected host credential paths",
      recordsContents: true,
    };
  }
  if (/Desktop/i.test(compact)) {
    return applyMode({ action: "confirm", risk: "medium", reason: "bash references Desktop" }, mode);
  }
  return null;
}

export function analyzeToolCall(
  toolName: string,
  input: any,
  home = homedir(),
  mode: GuardMode = resolveMode(),
): Decision {
  if (toolName === "bash" && typeof input?.command === "string") {
    return (
      shellMentionsProtectedPath(input.command, home, mode) ?? {
        action: "allow",
        risk: "none",
        reason: "No host-safety bash rule matched",
      }
    );
  }

  if ((toolName === "read" || toolName === "write" || toolName === "edit") && typeof input?.path === "string") {
    return analyzePathAccess(input.path, toolName, home, mode);
  }

  return { action: "allow", risk: "none", reason: "No host-safety rule matched" };
}

const PERSISTENCE_WARNING =
  "Approving records the resulting contents in this session transcript, where they persist even if you later revoke access.";

/** Fails closed: no UI, or no way to ask, means no approval. */
async function askForConfirmation(ctx: any, reason: string, recordsContents = false): Promise<boolean> {
  if (!ctx.hasUI) return false;
  const detail = recordsContents ? `${reason}\n\n${PERSISTENCE_WARNING}` : reason;
  if (typeof ctx.ui?.confirm === "function") {
    return Boolean(await ctx.ui.confirm("Host safety guard", `${detail}\n\nAllow this tool call?`));
  }
  if (typeof ctx.ui?.prompt === "function") {
    const answer = await ctx.ui.prompt(`${detail}\n\nType yes to allow:`);
    return String(answer).trim().toLowerCase() === "yes";
  }
  return false;
}

// Leading space sorts this ahead of letter-keyed extension statuses, so the warning
// survives Pi's right-truncation of the shared status line. Same trick as bash-guard.
const HOST_GUARD_STATUS_KEY = " host-guard";

export default function (pi: ExtensionAPI) {
  let mode: GuardMode = resolveMode();
  const approvals = new Set<string>();

  /** Off mode is easy to forget you enabled, so it gets a persistent badge. */
  const showModeBadge = (ctx: any) => {
    if (mode !== "off") {
      ctx.ui?.setStatus?.(HOST_GUARD_STATUS_KEY, undefined);
      return;
    }
    const theme = ctx.ui?.theme;
    if (!theme || typeof ctx.ui?.setStatus !== "function") return;
    ctx.ui.setStatus(
      HOST_GUARD_STATUS_KEY,
      theme.bg("toolErrorBg", theme.bold(theme.fg("error", " ⚠ HOST GUARD OFF "))),
    );
  };

  pi.registerFlag("host-guard-disabled", {
    description:
      "Start the session with host-safety-guard off (secrets floor still applies to key material).",
    type: "boolean",
  });

  pi.on("session_start", async (event: any, ctx: any) => {
    if (event?.reason === "startup" && pi.getFlag("--host-guard-disabled") === true) mode = "off";
    showModeBadge(ctx);
  });

  pi.registerCommand("host-guard", {
    description:
      "Show or set host-safety-guard prompting level: /host-guard [strict|high-only|off]",
    handler: async (args: string, ctx: any) => {
      const next = String(args ?? "").trim().toLowerCase();
      const requested = next === "disabled" ? "off" : next;
      if (requested === "strict" || requested === "high-only" || requested === "off") {
        mode = requested;
        approvals.clear();
        showModeBadge(ctx);
        if (mode === "off") {
          ctx.ui?.notify?.(
            "host-safety-guard OFF for this session. Private keys, keychains, ~/.secrets and 1Password data still prompt. Run /host-guard high-only to restore.",
            "warning",
          );
        } else {
          ctx.ui?.notify?.(`host-safety-guard mode: ${mode} (remembered approvals cleared)`, "info");
        }
        return;
      }
      ctx.ui?.notify?.(
        `host-safety-guard mode: ${mode}. Use /host-guard strict, high-only, or off.`,
        "info",
      );
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    const decision = analyzeToolCall(event.toolName, event.input, homedir(), mode);
    if (decision.action === "allow") return;
    if (decision.action === "block") return { block: true, reason: decision.reason };

    const target = typeof event.input?.path === "string" ? event.input.path : undefined;
    if (target && isApproved(approvals, target)) return;

    const ok = await askForConfirmation(ctx, decision.reason, decision.recordsContents === true);
    if (ok) {
      if (target) recordApproval(approvals, target);
      return;
    }
    return { block: true, reason: `Blocked by host-safety-guard: ${decision.reason}` };
  });
}
