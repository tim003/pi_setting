import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildPiCommand, normalizeMessageForTui, scriptWithExitTrap } from "../src/launch.ts";

test("buildPiCommand passes agent body text to append-system-prompt, not a file path", () => {
  const command = buildPiCommand({
    childHelperPath: "/ext/child-helper.ts",
    sessionFile: "/tmp/child.jsonl",
    message: "Do work",
    loadout: {
      name: "docs-auditor",
      agent: "delegate",
      cwd: "/workspace",
      model: "anthropic/claude-haiku-4-5",
      thinking: "low",
      tools: ["read", "bash"],
      systemPrompt: "You are the docs auditor.",
      autoExit: true,
    },
    piCodingAgentDir: "/root/.pi/agent",
  });

  assert.match(command, /--append-system-prompt 'You are the docs auditor\.'/);
  assert.doesNotMatch(command, /system-prompts\/docs-auditor\.md/);
  assert.match(command, /CMUX_SUBAGENT_AUTO_EXIT=1/);
  assert.match(command, /--tools 'read,bash,ask_question'/);
});

test("buildPiCommand explicitly loads pi-claude-auth when installed", () => {
  const agentDir = mkdtempSync(join(tmpdir(), "cmux-agent-dir-"));
  const claudeAuthPath = join(agentDir, "npm/node_modules/pi-claude-auth/src/index.ts");
  mkdirSync(join(agentDir, "npm/node_modules/pi-claude-auth/src"), { recursive: true });
  writeFileSync(claudeAuthPath, "// fake extension\n");

  const command = buildPiCommand({
    childHelperPath: "/ext/child-helper.ts",
    sessionFile: "/tmp/child.jsonl",
    message: "Do work",
    loadout: {
      name: "claude-child",
      agent: "delegate",
      model: "anthropic/claude-haiku-4-5",
    },
    piCodingAgentDir: agentDir,
  });

  assert.match(command, new RegExp(`--no-extensions -e '${claudeAuthPath}' -e '/ext/child-helper\\.ts'`));
});

test("normalizeMessageForTui makes multiline steer safe as one submitted message", () => {
  assert.equal(normalizeMessageForTui("line one\nline two\n\nline three"), "line one\\nline two\\n\\nline three");
});

test("scriptWithExitTrap writes an error exit sidecar on launch command failure", () => {
  const script = scriptWithExitTrap("cd /missing && pi 'hello'", "/tmp/child.jsonl");
  assert.match(script, /trap 'status=\$\?/);
  assert.match(script, /child\.jsonl\.exit/);
  assert.match(script, /type/);
  assert.match(script, /error/);
});
