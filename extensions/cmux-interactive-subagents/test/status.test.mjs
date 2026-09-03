import { test } from "node:test";
import assert from "node:assert/strict";
import { statusBadge } from "../src/fleet.ts";

const child = (status) => ({ status });

test("no children means no badge at all", () => {
  assert.equal(statusBadge([]), null);
});

// A finished child has already handed its result back and closed its tab,
// so it is not news.
test("children that have exited leave no badge", () => {
  assert.equal(statusBadge([child("finished"), child("failed")]), null);
});

test("a single running child reads in the singular", () => {
  const badge = statusBadge([child("running")]);
  assert.equal(badge.text, "⚡ 1 subagent");
  assert.equal(badge.tone, "accent");
});

test("several running children are counted", () => {
  const badge = statusBadge([child("running"), child("running"), child("running")]);
  assert.equal(badge.text, "⚡ 3 subagents");
  assert.equal(badge.tone, "accent");
});

// Waiting is the state that costs the user something: the child has stopped
// and stays stopped until it is answered, so it must not look like progress.
test("a waiting child is called out ahead of running ones", () => {
  const badge = statusBadge([child("waiting"), child("running")]);
  assert.equal(badge.text, "⏸ 1 waiting · ⚡ 1 running");
  assert.equal(badge.tone, "warning");
});

test("waiting alone does not mention running", () => {
  const badge = statusBadge([child("waiting"), child("finished")]);
  assert.equal(badge.text, "⏸ 1 waiting");
  assert.equal(badge.tone, "warning");
});

test("multiple waiting children are counted", () => {
  const badge = statusBadge([child("waiting"), child("waiting"), child("running")]);
  assert.equal(badge.text, "⏸ 2 waiting · ⚡ 1 running");
  assert.equal(badge.tone, "warning");
});

test("exited children are ignored while others are still live", () => {
  const badge = statusBadge([child("finished"), child("running"), child("failed")]);
  assert.equal(badge.text, "⚡ 1 subagent");
});
