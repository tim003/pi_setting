import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePathAccess,
  analyzeToolCall,
  isApproved,
  recordApproval,
  resolveMode,
} from "../index.ts";

const home = "/Users/tester";

test("allows reading image files from ~/Desktop/pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/Screenshot 2026-09-01.png", "read", home);
  assert.equal(decision.action, "allow");
});

test("requires confirmation for non-image reads in ~/Desktop/pi-inbox in strict mode", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/notes.txt", "read", home, "strict");
  assert.equal(decision.action, "confirm");
  assert.equal(decision.risk, "medium");
});

test("requires confirmation for Desktop access outside pi-inbox in strict mode", () => {
  const decision = analyzePathAccess("~/Desktop/random.png", "read", home, "strict");
  assert.equal(decision.action, "confirm");
  assert.equal(decision.risk, "medium");
});

test("auto-allows medium risk paths in default high-only mode", () => {
  assert.equal(analyzePathAccess("~/Desktop/pi-inbox/notes.txt", "read", home).action, "allow");
  assert.equal(analyzePathAccess("~/Desktop/random.png", "read", home).action, "allow");
  assert.equal(analyzeToolCall("bash", { command: "ls ~/Desktop" }, home).action, "allow");
});

test("asks before touching protected credential paths in every mode", () => {
  for (const mode of ["high-only", "strict"]) {
    const decision = analyzePathAccess("~/.ssh/id_ed25519", "read", home, mode);
    assert.equal(decision.action, "confirm");
    assert.equal(decision.risk, "high");
  }
});

test("warns that approving a secret read records its contents in the session", () => {
  const decision = analyzePathAccess("~/.ssh/id_ed25519", "read", home);
  assert.equal(decision.recordsContents, true);
});

test("does not warn about recorded contents when writing rather than reading", () => {
  const decision = analyzePathAccess("~/.ssh/id_ed25519", "write", home);
  assert.equal(decision.action, "confirm");
  assert.notEqual(decision.recordsContents, true);
});

test("asks about secret-looking filenames even inside pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/api-token.png", "read", home);
  assert.equal(decision.action, "confirm");
  assert.equal(decision.risk, "high");
});

test("flags bash commands that mention Desktop for confirmation in strict mode", () => {
  const decision = analyzeToolCall("bash", { command: "ls ~/Desktop" }, home, "strict");
  assert.equal(decision.action, "confirm");
});

test("asks about bash commands that mention protected credential paths", () => {
  const decision = analyzeToolCall("bash", { command: "ls ~/.ssh" }, home);
  assert.equal(decision.action, "confirm");
  assert.equal(decision.risk, "high");
});

test("warns that approving a credential-path bash command records its output", () => {
  const decision = analyzeToolCall("bash", { command: "cat ~/.ssh/id_ed25519" }, home);
  assert.equal(decision.recordsContents, true);
});

test("resolveMode reads env override and falls back to high-only", () => {
  assert.equal(resolveMode({}), "high-only");
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "strict" }), "strict");
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "HIGH-ONLY" }), "high-only");
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "nonsense" }), "high-only");
});

test("remembered approvals stop repeat prompts for the same path", () => {
  const approvals = new Set();
  const target = "~/Desktop/report.pdf";
  assert.equal(isApproved(approvals, target, home), false);
  recordApproval(approvals, target, home);
  assert.equal(isApproved(approvals, target, home), true);
  assert.equal(isApproved(approvals, "~/Desktop/other.pdf", home), false);
});
