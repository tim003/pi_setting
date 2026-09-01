import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sanitizeName } from "./core.ts";

export type ChildLoadout = {
  name: string;
  agent: string;
  cwd?: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  systemPrompt?: string;
  autoExit?: boolean;
};

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function makeChildSessionPath(baseDir: string, name: string): string {
  const safeName = sanitizeName(name);
  const suffix = Math.random().toString(16).slice(2, 10);
  mkdirSync(baseDir, { recursive: true });
  return join(baseDir, `${timestamp()}-${safeName}-${suffix}.jsonl`);
}

function textFromMessage(message: any): string | null {
  if (message?.role !== "assistant" || !Array.isArray(message.content)) return null;
  for (const part of message.content) {
    if (part?.type === "text" && typeof part.text === "string") return part.text;
  }
  return null;
}

export function readFinalAssistantMessage(sessionFile: string): string {
  if (!existsSync(sessionFile)) return "";
  const lines = readFileSync(sessionFile, "utf8").split(/\r?\n/);
  let final = "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const text = textFromMessage(entry.message ?? entry);
      if (text !== null) final = text;
    } catch {
      // Ignore malformed/non-JSON lines; session files can contain only JSONL in normal Pi use.
    }
  }
  return final;
}

export function loadoutPath(sessionFile: string): string {
  return `${sessionFile}.loadout.json`;
}

export function writeLoadout(sessionFile: string, loadout: ChildLoadout): void {
  mkdirSync(dirname(sessionFile), { recursive: true });
  writeFileSync(loadoutPath(sessionFile), JSON.stringify(loadout, null, 2), "utf8");
}

export function readLoadout(sessionFile: string): ChildLoadout | null {
  const path = loadoutPath(sessionFile);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ChildLoadout;
}
