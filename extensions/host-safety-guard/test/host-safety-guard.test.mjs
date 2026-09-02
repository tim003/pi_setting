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

/**
 * Off mode exists so routine diagnosis (reading ~/.ssh/config to find the
 * IdentityAgent, say) stops prompting. It is deliberately not a blanket "allow
 * everything": a credential read cannot be undone once it is in the transcript,
 * so key material keeps prompting even here.
 */
test("resolveMode reads off from the environment", () => {
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "off" }), "off");
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "disabled" }), "off");
});

test("resolveMode still defaults to high-only and honours strict", () => {
  assert.equal(resolveMode({}), "high-only");
  assert.equal(resolveMode({ PI_HOST_GUARD_LEVEL: "strict" }), "strict");
});

test("off mode releases non-secret config files inside protected directories", () => {
  for (const path of ["~/.ssh/config", "~/.ssh/known_hosts", "~/.aws/config", "~/.gnupg/gpg.conf"]) {
    assert.equal(analyzePathAccess(path, "read", home, "off").action, "allow", path);
  }
});

test("off mode releases public keys but never the matching private key", () => {
  assert.equal(analyzePathAccess("~/.ssh/github.pub", "read", home, "off").action, "allow");
  assert.equal(analyzePathAccess("~/.ssh/github", "read", home, "off").action, "confirm");
});

test("off mode floor still guards private key material", () => {
  for (const path of ["~/.ssh/id_ed25519", "~/.ssh/id_rsa", "~/.gnupg/secring.gpg", "~/.kube/config"]) {
    const decision = analyzePathAccess(path, "read", home, "off");
    assert.equal(decision.action, "confirm", path);
    assert.equal(decision.risk, "high", path);
  }
});

test("off mode floor still guards keychains, secrets and 1Password", () => {
  for (const path of [
    "~/Library/Keychains/login.keychain-db",
    "~/.secrets/deploy.json",
    "~/Library/Application Support/1Password/data.sqlite",
    "~/.aws/credentials",
  ]) {
    assert.equal(analyzePathAccess(path, "read", home, "off").action, "confirm", path);
  }
});

test("off mode keeps the transcript-persistence warning on floored reads", () => {
  const decision = analyzePathAccess("~/.ssh/id_ed25519", "read", home, "off");
  assert.equal(decision.recordsContents, true);
});

test("off mode drops the medium-risk Desktop prompts entirely", () => {
  assert.equal(analyzePathAccess("~/Desktop/random.png", "read", home, "off").action, "allow");
  assert.equal(analyzePathAccess("~/Desktop/pi-inbox/notes.txt", "read", home, "off").action, "allow");
});

test("off mode releases bash commands that only touch releasable paths", () => {
  for (const command of ["cat ~/.ssh/config", "grep IdentityAgent ~/.ssh/config", "ls ~/.ssh/known_hosts"]) {
    const decision = analyzeToolCall("bash", { command }, home, "off");
    assert.equal(decision.action, "allow", command);
  }
});

test("off mode still confirms bash commands touching key material", () => {
  for (const command of ["cat ~/.ssh/id_ed25519", "cp ~/.ssh/id_rsa /tmp/x", "cat ~/.ssh/config ~/.ssh/id_rsa"]) {
    const decision = analyzeToolCall("bash", { command }, home, "off");
    assert.equal(decision.action, "confirm", command);
    assert.equal(decision.recordsContents, true, command);
  }
});

test("high-only mode is unchanged by the addition of off", () => {
  assert.equal(analyzePathAccess("~/.ssh/config", "read", home, "high-only").action, "confirm");
  assert.equal(analyzePathAccess("~/Desktop/random.png", "read", home, "high-only").action, "allow");
});
