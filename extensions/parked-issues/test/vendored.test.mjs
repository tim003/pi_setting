/*
 * VENDORED: an identical copy of this file lives in both
 * extensions/parked-issues/ and extensions/cmux-interactive-subagents/,
 * except for the SIBLING constant naming the other extension.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIBLING = "cmux-interactive-subagents";

// Files copied wholesale into both extensions. Each is deployed standalone, so
// they cannot import from one another; keeping them identical is enforced here
// instead, because the alternative is a rendering fix that silently lands in
// one popup and not the other.
const SHARED = ["src/ui/frame.ts", "src/ui/select.ts", "test/frame.test.mjs", "test/select.test.mjs"];

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const sibling = join(dirname(here), SIBLING);

for (const rel of SHARED) {
  test(`${rel} matches the copy in ${SIBLING}`, (t) => {
    // Absent when this extension has been deployed on its own, which is the
    // normal installed shape and not a failure.
    if (!existsSync(sibling)) {
      t.skip(`${SIBLING} not present; nothing to compare against`);
      return;
    }
    const mine = readFileSync(join(here, rel), "utf8");
    const theirs = readFileSync(join(sibling, rel), "utf8");
    assert.equal(
      mine,
      theirs,
      `${rel} has drifted from ${SIBLING}. Copy the newer file over the older one ` +
        `and run both test suites; do not fix only the copy you happened to open.`,
    );
  });
}
