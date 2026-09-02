import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { PARKED_DIR, issuesFilePath, renderChecklist, writeIssuesFile } from "../src/store.ts";

function issue(overrides = {}) {
	return {
		id: "2026-09-02T10:00:00",
		title: "Flip inheritSkills for subagents",
		severity: "low",
		status: "open",
		priority: 100,
		source: "agent",
		...overrides,
	};
}

function withTempDir(run) {
	const dir = mkdtempSync(join(tmpdir(), "parked-"));
	try {
		return run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test("renders an open issue as an unchecked box carrying its severity", () => {
	const out = renderChecklist([issue({ severity: "high", title: "Credentials committed" })]);
	assert.match(out, /- \[ \] .*high.* Credentials committed/);
});

test("renders a resolved issue as a checked box", () => {
	const out = renderChecklist([issue({ status: "resolved" })]);
	assert.match(out, /- \[x\] .*Flip inheritSkills/);
});

test("omits discarded issues entirely", () => {
	const out = renderChecklist([issue({ status: "discarded" })]);
	assert.doesNotMatch(out, /Flip inheritSkills/);
});

test("names the highest-ranked open issue as what comes next", () => {
	const out = renderChecklist([
		issue({ id: "a", title: "Low priority thing", severity: "low" }),
		issue({ id: "b", title: "Urgent thing", severity: "high" }),
	]);
	assert.match(out, /Next:.*Urgent thing/);
});

test("reports an empty backlog without inventing a next task", () => {
	const out = renderChecklist([]);
	assert.doesNotMatch(out, /Next:/);
	assert.match(out, /No parked issues/i);
});

test("writes the checklist to .parked/ISSUES.md under the project root", () => {
	withTempDir((dir) => {
		writeIssuesFile(dir, [issue()]);
		const written = readFileSync(issuesFilePath(dir), "utf8");
		assert.match(written, /Flip inheritSkills/);
	});
});

test("leaves no temp files behind after an atomic write", () => {
	withTempDir((dir) => {
		writeIssuesFile(dir, [issue()]);
		const stray = readdirSync(join(dir, PARKED_DIR)).filter((name) => name !== "ISSUES.md");
		assert.deepEqual(stray, []);
	});
});

test("creates the .parked directory when it does not yet exist", () => {
	withTempDir((dir) => {
		assert.equal(existsSync(join(dir, PARKED_DIR)), false);
		writeIssuesFile(dir, [issue()]);
		assert.equal(existsSync(join(dir, PARKED_DIR)), true);
	});
});
