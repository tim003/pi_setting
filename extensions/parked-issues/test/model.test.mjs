import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PARKED_RECORDED, PARKED_UPDATED, foldIssues, sortIssues } from "../src/model.ts";

function recorded(issue) {
	return { type: "custom", customType: PARKED_RECORDED, data: { issue } };
}

function updated(id, patch) {
	return { type: "custom", customType: PARKED_UPDATED, data: { id, ...patch } };
}

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

test("folds a recorded entry into a single open issue", () => {
	const issues = foldIssues([recorded(issue())]);
	assert.equal(issues.length, 1);
	assert.equal(issues[0].title, "Flip inheritSkills for subagents");
	assert.equal(issues[0].status, "open");
});

test("applies a later status update to a recorded issue", () => {
	const issues = foldIssues([recorded(issue()), updated("2026-09-02T10:00:00", { status: "resolved" })]);
	assert.equal(issues[0].status, "resolved");
});

test("applies a priority update without touching other fields", () => {
	const issues = foldIssues([recorded(issue()), updated("2026-09-02T10:00:00", { priority: 0 })]);
	assert.equal(issues[0].priority, 0);
	assert.equal(issues[0].title, "Flip inheritSkills for subagents");
});

test("lets the last update win when two updates target the same issue", () => {
	const issues = foldIssues([
		recorded(issue()),
		updated("2026-09-02T10:00:00", { status: "resolved" }),
		updated("2026-09-02T10:00:00", { status: "discarded" }),
	]);
	assert.equal(issues[0].status, "discarded");
});

test("ignores an update for an id that was never recorded", () => {
	const issues = foldIssues([recorded(issue()), updated("does-not-exist", { status: "resolved" })]);
	assert.equal(issues.length, 1);
	assert.equal(issues[0].status, "open");
});

test("ignores entries belonging to other extensions", () => {
	const entries = [{ type: "custom", customType: "om.observations.recorded", data: {} }, recorded(issue())];
	assert.equal(foldIssues(entries).length, 1);
});

test("sortIssues puts high severity ahead of low regardless of priority", () => {
	const sorted = sortIssues([
		issue({ id: "a", severity: "low", priority: 0 }),
		issue({ id: "b", severity: "high", priority: 100 }),
	]);
	assert.deepEqual(
		sorted.map((entry) => entry.id),
		["b", "a"],
	);
});

test("sortIssues orders by priority within the same severity", () => {
	const sorted = sortIssues([
		issue({ id: "a", severity: "low", priority: 10 }),
		issue({ id: "b", severity: "low", priority: 0 }),
	]);
	assert.deepEqual(
		sorted.map((entry) => entry.id),
		["b", "a"],
	);
});
