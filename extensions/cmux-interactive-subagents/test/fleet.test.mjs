import { test } from "node:test";
import assert from "node:assert/strict";
import { closesTabOnExit, fleetRows, formatElapsed } from "../src/fleet.ts";

const NOW = 1_000_000;
const child = (over = {}) => ({
  name: "worker",
  agent: "delegate",
  task: "do a thing",
  status: "running",
  surface: "surface:26",
  startedAt: NOW - 5_000,
  ...over,
});

test("no children means no rows", () => {
  assert.deepEqual(fleetRows([], NOW), []);
});

test("a row names the child, its agent and its status", () => {
  const [row] = fleetRows([child()], NOW);
  assert.equal(row.name, "worker");
  assert.match(row.label, /worker/);
  assert.match(row.description, /delegate/);
  assert.match(row.description, /running/);
});

// A child that asked a question is blocked until answered, so it is the
// one thing in the list that actually needs the human.
test("waiting children sort above running ones", () => {
  const rows = fleetRows(
    [
      child({ name: "a", status: "running" }),
      child({ name: "b", status: "finished" }),
      child({ name: "c", status: "waiting" }),
    ],
    NOW,
  );
  assert.deepEqual(rows.map((r) => r.name), ["c", "a", "b"]);
});

// Rotation is only possible for a child that still owns a tab.
test("a child can be shown only while it holds a surface", () => {
  assert.equal(fleetRows([child()], NOW)[0].canShow, true);
  assert.equal(fleetRows([child({ surface: "" })], NOW)[0].canShow, false);
});

test("elapsed time is human readable", () => {
  assert.equal(formatElapsed(0), "0s");
  assert.equal(formatElapsed(5_000), "5s");
  assert.equal(formatElapsed(65_000), "1m5s");
  assert.equal(formatElapsed(3_600_000), "1h0m");
});

test("a row reports how long the child has been going", () => {
  const [row] = fleetRows([child({ startedAt: NOW - 65_000 })], NOW);
  assert.match(row.description, /1m5s/);
});

// The human chose that a failed child's tab closes too: the error is
// delivered to the parent and kept in the session file either way.
test("both finished and failed children give their tab back", () => {
  assert.equal(closesTabOnExit("finished"), true);
  assert.equal(closesTabOnExit("failed"), true);
});

test("a live child keeps its tab", () => {
  assert.equal(closesTabOnExit("running"), false);
  assert.equal(closesTabOnExit("waiting"), false);
});
