import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { settingsOverride } from "../src/settings.ts";

test("settingsOverride reads subagents agentOverrides model and thinking", () => {
  const agentDir = mkdtempSync(join(tmpdir(), "cmux-settings-"));
  writeFileSync(
    join(agentDir, "settings.json"),
    JSON.stringify({ subagents: { agentOverrides: { delegate: { model: "anthropic/claude-haiku-4-5", thinking: "low" } } } }),
  );
  assert.deepEqual(settingsOverride(agentDir, "delegate"), { model: "anthropic/claude-haiku-4-5", thinking: "low" });
  assert.deepEqual(settingsOverride(agentDir, "unknown"), { model: undefined, thinking: undefined });
});
