import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closeSurfaceArgs,
  focusSurfaceArgs,
  newSurfaceArgs,
  parseCallerPane,
} from "../src/cmux.ts";

// A child must never carve up the user's layout. It goes into the parent's
// pane as a tab that is not selected, so the parent keeps the whole pane.
test("a child surface is created as an unfocused tab in the parent pane", () => {
  const args = newSurfaceArgs("pane:2");
  assert.equal(args[0], "new-surface");
  assert.deepEqual(
    args.slice(1),
    ["--type", "terminal", "--pane", "pane:2", "--focus", "false"],
  );
});

test("creating a child never asks for focus", () => {
  const args = newSurfaceArgs("pane:2");
  const i = args.indexOf("--focus");
  assert.notEqual(i, -1, "focus must be stated explicitly, not left to a default");
  assert.equal(args[i + 1], "false");
});

// Without a pane we cannot make a tab, so fall back to the old behaviour
// rather than failing to launch at all.
test("with no known pane it falls back to a split", () => {
  assert.deepEqual(newSurfaceArgs(null), ["new-split", "right"]);
  assert.deepEqual(newSurfaceArgs(""), ["new-split", "right"]);
});

test("closing targets exactly one surface", () => {
  assert.deepEqual(closeSurfaceArgs("surface:26"), ["close-surface", "--surface", "surface:26"]);
});

// Focus is only ever requested when the human picks a child from /fleet.
test("focusing a child brings its tab forward in its pane", () => {
  const args = focusSurfaceArgs("surface:26", "pane:2");
  assert.equal(args[0], "move-surface");
  assert.deepEqual(
    args.slice(1),
    ["--surface", "surface:26", "--pane", "pane:2", "--focus", "true"],
  );
});

test("parseCallerPane prefers the stable uuid over the ref", () => {
  const out = JSON.stringify({
    caller: { pane_id: "581D0D14-D336-45E1-90F5-5BD07B3F015E", pane_ref: "pane:2" },
  });
  assert.equal(parseCallerPane(out), "581D0D14-D336-45E1-90F5-5BD07B3F015E");
});

test("parseCallerPane falls back to the ref when no uuid is present", () => {
  const out = JSON.stringify({ caller: { pane_ref: "pane:2" } });
  assert.equal(parseCallerPane(out), "pane:2");
});

test("parseCallerPane returns null rather than guessing", () => {
  assert.equal(parseCallerPane(""), null);
  assert.equal(parseCallerPane("not json"), null);
  assert.equal(parseCallerPane(JSON.stringify({ caller: {} })), null);
  assert.equal(parseCallerPane(JSON.stringify({})), null);
});
