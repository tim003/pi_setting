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

export function createSurface(name: string): string {
  const output = execFileSync("cmux", ["new-split", "right"], { encoding: "utf8" }).trim();
  const surface = parseSurface(output, "new-split");
  try {
    execFileSync("cmux", ["rename-tab", "--surface", surface, name], { encoding: "utf8" });
  } catch {
    // Cosmetic only.
  }
  return surface;
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
