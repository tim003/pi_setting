import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Decision =
  | { action: "allow"; reason: string }
  | { action: "confirm"; reason: string }
  | { action: "block"; reason: string };

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

export function analyzePathAccess(path: string, operation: string, home = homedir()): Decision {
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

  if (SECRET_NAME_RE.test(target)) {
    return { action: "block", reason: `Blocked ${operation}: path name looks secret-bearing (${path})` };
  }

  for (const dir of protectedDirs) {
    if (isWithin(target, dir)) return { action: "block", reason: `Blocked ${operation}: protected host path (${path})` };
  }

  if (isWithin(target, inbox)) {
    if (IMAGE_EXTENSIONS.has(extensionOf(target)) && operation === "read") {
      return { action: "allow", reason: "Allowed read of image in ~/Desktop/pi-inbox" };
    }
    return { action: "confirm", reason: `${operation} in ~/Desktop/pi-inbox requires confirmation unless it is reading an image` };
  }

  if (isWithin(target, desktop)) {
    return { action: "confirm", reason: `${operation} on Desktop outside ~/Desktop/pi-inbox requires confirmation` };
  }

  return { action: "allow", reason: "No host-safety path rule matched" };
}

function shellMentionsProtectedPath(command: string, home = homedir()): Decision | null {
  const compact = command.replace(/\\ /g, " ");
  const protectedPatterns = [
    "~/.ssh", `${home}/.ssh`,
    "~/.gnupg", `${home}/.gnupg`,
    "~/.aws", `${home}/.aws`,
    "~/Library/Keychains", `${home}/Library/Keychains`,
    "~/.secrets", `${home}/.secrets`,
  ];
  if (protectedPatterns.some((pattern) => compact.includes(pattern))) {
    return { action: "block", reason: "Blocked bash: command references protected host credential paths" };
  }
  if (/Desktop/i.test(compact)) {
    return { action: "confirm", reason: "bash references Desktop; confirm host file access" };
  }
  return null;
}

export function analyzeToolCall(toolName: string, input: any, home = homedir()): Decision {
  if (toolName === "bash" && typeof input?.command === "string") {
    return shellMentionsProtectedPath(input.command, home) ?? { action: "allow", reason: "No host-safety bash rule matched" };
  }

  if ((toolName === "read" || toolName === "write" || toolName === "edit") && typeof input?.path === "string") {
    return analyzePathAccess(input.path, toolName, home);
  }

  return { action: "allow", reason: "No host-safety rule matched" };
}

async function askForConfirmation(ctx: any, reason: string): Promise<boolean> {
  if (!ctx.hasUI) return false;
  if (typeof ctx.ui?.confirm === "function") return Boolean(await ctx.ui.confirm("Host safety guard", `${reason}\n\nAllow this tool call?`));
  if (typeof ctx.ui?.prompt === "function") {
    const answer = await ctx.ui.prompt(`${reason}\n\nType yes to allow:`);
    return String(answer).trim().toLowerCase() === "yes";
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const decision = analyzeToolCall(event.toolName, event.input);
    if (decision.action === "allow") return;
    if (decision.action === "block") return { block: true, reason: decision.reason };

    const ok = await askForConfirmation(ctx, decision.reason);
    if (ok) return;
    return { block: true, reason: `Blocked by host-safety-guard: ${decision.reason}` };
  });
}
