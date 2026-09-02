import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type GuardMode = "high-only" | "strict";
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
  return raw === "strict" ? "strict" : "high-only";
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

export default function (pi: ExtensionAPI) {
  let mode: GuardMode = resolveMode();
  const approvals = new Set<string>();

  pi.registerCommand("host-guard", {
    description: "Show or set host-safety-guard prompting level: /host-guard [strict|high-only]",
    handler: async (args: string, ctx: any) => {
      const next = String(args ?? "").trim().toLowerCase();
      if (next === "strict" || next === "high-only") {
        mode = next;
        approvals.clear();
        ctx.ui?.notify?.(`host-safety-guard mode: ${mode} (remembered approvals cleared)`, "info");
        return;
      }
      ctx.ui?.notify?.(
        `host-safety-guard mode: ${mode}. Use /host-guard strict or /host-guard high-only.`,
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
