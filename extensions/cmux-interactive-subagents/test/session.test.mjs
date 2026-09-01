import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import {
  makeChildSessionPath,
  readFinalAssistantMessage,
  readLoadout,
  writeLoadout,
} from "../src/session.ts";

test("makeChildSessionPath creates a safe jsonl filename containing the child name", () => {
  const dir = mkdtempSync(join(tmpdir(), "cmux-session-"));
  const path = makeChildSessionPath(dir, "docs-auditor");
  assert.equal(path.startsWith(dir), true);
  assert.equal(path.endsWith(".jsonl"), true);
  assert.match(basename(path), /docs-auditor/);
  assert.doesNotMatch(basename(path), /[ /]/);
});

test("readFinalAssistantMessage returns the last assistant text from jsonl entries", () => {
  const dir = mkdtempSync(join(tmpdir(), "cmux-session-"));
  const file = join(dir, "child.jsonl");
  writeFileSync(
    file,
    [
      JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "first" }] } }),
      JSON.stringify({ role: "assistant", content: [{ type: "toolCall", name: "read" }] }),
      JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "final answer" }] } }),
    ].join("\n"),
  );
  assert.equal(readFinalAssistantMessage(file), "final answer");
});

test("writeLoadout and readLoadout round-trip metadata beside the session file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cmux-session-"));
  const file = join(dir, "child.jsonl");
  const loadout = { name: "docs-auditor", agent: "researcher", cwd: "/workspace", model: "anthropic/claude-haiku-4-5" };
  writeLoadout(file, loadout);
  assert.deepEqual(readLoadout(file), loadout);
  assert.match(readFileSync(`${file}.loadout.json`, "utf8"), /docs-auditor/);
});
