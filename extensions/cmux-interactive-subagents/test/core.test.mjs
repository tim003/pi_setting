import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chooseMessageMode,
  resolveResumeSurface,
  sanitizeName,
  shouldAutoExitOnAgentEnd,
  validateLaunch,
} from "../src/core.ts";

test("resolveResumeSurface reuses a live surface and recreates a closed one", () => {
  const live = resolveResumeSurface({
    name: "docs-auditor",
    surface: "surface:7",
    surfaceExists: (surface) => surface === "surface:7",
    createSurface: () => "surface:99",
  });
  assert.deepEqual(live, { surface: "surface:7", recreated: false });

  const recreated = resolveResumeSurface({
    name: "docs-auditor",
    surface: "surface:7",
    surfaceExists: () => false,
    createSurface: (name) => (name === "docs-auditor" ? "surface:99" : "surface:0"),
  });
  assert.deepEqual(recreated, { surface: "surface:99", recreated: true });
});

test("sanitizeName accepts stable lane-style names unchanged", () => {
  assert.equal(sanitizeName("docs-auditor-1"), "docs-auditor-1");
  assert.equal(sanitizeName("repo.scout_A"), "repo.scout_A");
});

test("sanitizeName rejects empty or unsafe names", () => {
  assert.throws(() => sanitizeName(""), /required/);
  assert.throws(() => sanitizeName("two words"), /safe/);
  assert.throws(() => sanitizeName("../escape"), /safe/);
});

test("validateLaunch requires name agent task and rejects duplicate names", () => {
  assert.deepEqual(
    validateLaunch({ name: "docs-auditor", agent: "researcher", task: "Read docs" }, new Set()),
    { ok: true, name: "docs-auditor", agent: "researcher", task: "Read docs" },
  );
  assert.deepEqual(validateLaunch({ agent: "researcher", task: "Read docs" }, new Set()), {
    ok: false,
    error: "subagent.name is required",
  });
  assert.deepEqual(
    validateLaunch({ name: "docs-auditor", agent: "researcher", task: "Read docs" }, new Set(["docs-auditor"])),
    { ok: false, error: "Subagent name already exists: docs-auditor. Use subagent_message to contact it." },
  );
});

test("chooseMessageMode routes by known running or finished child name", () => {
  const registry = new Map([
    ["docs-auditor", { status: "running" }],
    ["settings-reviewer", { status: "finished" }],
  ]);
  assert.deepEqual(chooseMessageMode("docs-auditor", registry), { ok: true, mode: "steer" });
  assert.deepEqual(chooseMessageMode("settings-reviewer", registry), { ok: true, mode: "resume" });
  assert.deepEqual(chooseMessageMode("missing", registry), { ok: false, error: "Unknown subagent name: missing" });
});

test("shouldAutoExitOnAgentEnd waits for parent answers and running children", () => {
  const normalMessages = [{ role: "assistant", stopReason: "end", content: [{ type: "text", text: "done" }] }];
  assert.equal(shouldAutoExitOnAgentEnd({ autoExit: true, awaitingAnswer: false, runningChildren: 0 }, normalMessages), true);
  assert.equal(shouldAutoExitOnAgentEnd({ autoExit: false, awaitingAnswer: false, runningChildren: 0 }, normalMessages), false);
  assert.equal(shouldAutoExitOnAgentEnd({ autoExit: true, awaitingAnswer: true, runningChildren: 0 }, normalMessages), false);
  assert.equal(shouldAutoExitOnAgentEnd({ autoExit: true, awaitingAnswer: false, runningChildren: 1 }, normalMessages), false);
  assert.equal(
    shouldAutoExitOnAgentEnd({ autoExit: true, awaitingAnswer: false, runningChildren: 0 }, [
      { role: "assistant", stopReason: "aborted", content: [] },
    ]),
    false,
  );
});
