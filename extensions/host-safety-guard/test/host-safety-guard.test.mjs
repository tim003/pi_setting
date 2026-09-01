import test from "node:test";
import assert from "node:assert/strict";
import { analyzePathAccess, analyzeToolCall } from "../index.ts";

const home = "/Users/tester";

test("allows reading image files from ~/Desktop/pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/Screenshot 2026-09-01.png", "read", home);
  assert.equal(decision.action, "allow");
});

test("requires confirmation for non-image reads in ~/Desktop/pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/notes.txt", "read", home);
  assert.equal(decision.action, "confirm");
});

test("requires confirmation for Desktop access outside pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/random.png", "read", home);
  assert.equal(decision.action, "confirm");
});

test("blocks protected credential paths", () => {
  const decision = analyzePathAccess("~/.ssh/id_ed25519", "read", home);
  assert.equal(decision.action, "block");
});

test("blocks secret-looking filenames even inside pi-inbox", () => {
  const decision = analyzePathAccess("~/Desktop/pi-inbox/api-token.png", "read", home);
  assert.equal(decision.action, "block");
});

test("flags bash commands that mention Desktop for confirmation", () => {
  const decision = analyzeToolCall("bash", { command: "ls ~/Desktop" }, home);
  assert.equal(decision.action, "confirm");
});

test("blocks bash commands that mention protected credential paths", () => {
  const decision = analyzeToolCall("bash", { command: "ls ~/.ssh" }, home);
  assert.equal(decision.action, "block");
});
