import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function shellEscape(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function hasCmux(): boolean {
  if (!process.env.CMUX_SOCKET_PATH) return false;
  try {
    execFileSync("cmux", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    try {
      execFileSync("sh", ["-lc", "command -v cmux"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

export function cmuxUnavailableText(): string {
  return [
    "cmux is not available to this Pi process.",
    "Start Pi from a process that has both `cmux` on PATH and `CMUX_SOCKET_PATH` set.",
    "This custom extension intentionally does not implement Docker-to-host cmux bridging.",
  ].join(" ");
}

function parseSurface(output: string, command: string): string {
  const match = output.match(/surface:\d+/);
  if (!match) throw new Error(`Unexpected cmux ${command} output: ${output || "(empty)"}`);
  return match[0];
}

/**
 * A child belongs in the parent's pane as an unselected tab, not in a split.
 * Splits divide the screen and shrink the parent's session with every spawn;
 * tabs cost one entry in the tab bar and leave the layout alone. The child is
 * still a real terminal, so it can be steered and later brought forward.
 */
export function newSurfaceArgs(pane: string | null | undefined): string[] {
  if (!pane) return ["new-split", "right"];
  return ["new-surface", "--type", "terminal", "--pane", pane, "--focus", "false"];
}

export function closeSurfaceArgs(surface: string): string[] {
  return ["close-surface", "--surface", surface];
}

/** The only call that asks for focus, and only ever on the human's request. */
export function focusSurfaceArgs(surface: string, pane: string): string[] {
  return ["move-surface", "--surface", surface, "--pane", pane, "--focus", "true"];
}

/** cmux exposes the surface in CMUX_PANEL_ID, never the pane, so we must ask. */
export function parseCallerPane(output: string): string | null {
  try {
    const caller = JSON.parse(output)?.caller;
    return caller?.pane_id ?? caller?.pane_ref ?? null;
  } catch {
    return null;
  }
}

export function callerPane(): string | null {
  try {
    return parseCallerPane(
      execFileSync("cmux", ["identify", "--id-format", "both"], { encoding: "utf8" }),
    );
  } catch {
    return null;
  }
}

export function createSurface(name: string, pane: string | null): string {
  const args = newSurfaceArgs(pane);
  const output = execFileSync("cmux", args, { encoding: "utf8" }).trim();
  const surface = parseSurface(output, args[0]);
  try {
    execFileSync("cmux", ["rename-tab", "--surface", surface, name], { encoding: "utf8" });
  } catch {
    // Cosmetic only.
  }
  return surface;
}

export function closeSurface(surface: string): void {
  if (!surface) return;
  try {
    execFileSync("cmux", closeSurfaceArgs(surface), { stdio: "ignore" });
  } catch {
    // The tab may already be gone; nothing to reclaim.
  }
}

export function focusSurface(surface: string, pane: string): boolean {
  if (!surface || !pane) return false;
  try {
    execFileSync("cmux", focusSurfaceArgs(surface, pane), { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function surfaceExists(surface: string): boolean {
  if (!surface) return false;
  try {
    execFileSync("cmux", ["read-screen", "--surface", surface, "--lines", "1"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function sendText(surface: string, text: string): void {
  execFileSync("cmux", ["send", "--surface", surface, text], { encoding: "utf8" });
}

export function sendCommand(surface: string, command: string): void {
  sendText(surface, `${command}\n`);
}

export function sendLongCommand(surface: string, command: string, scriptPath: string): string {
  mkdirSync(dirname(scriptPath), { recursive: true });
  writeFileSync(scriptPath, `#!/bin/bash\nset -euo pipefail\n${command}\n`, { mode: 0o755 });
  sendCommand(surface, `bash ${shellEscape(scriptPath)}`);
  return scriptPath;
}

export function readScreen(surface: string, lines = 50): string {
  return execFileSync("cmux", ["read-screen", "--surface", surface, "--lines", String(lines)], {
    encoding: "utf8",
  });
}

export function childScriptPath(extensionDir: string, childName: string): string {
  return join(extensionDir, ".generated", `${childName}.launch.sh`);
}
