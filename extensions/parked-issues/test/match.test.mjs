import test from "node:test";
import assert from "node:assert/strict";
import { findIssue } from "../src/match.ts";

const open = (id, title) => ({
	id,
	title,
	severity: "medium",
	status: "open",
	priority: 100,
	source: "agent",
});

const issues = [
	open("2026-09-02T13:27:16.0", "docs/wiring/netlist.md — the designated source of truth"),
	open("2026-09-02T13:35:03.1", "Saved Cirkit diagram diverges from the repo design"),
];

test("finds an issue by its exact id", () => {
	const result = findIssue(issues, "2026-09-02T13:35:03.1");
	assert.equal(result.kind, "found");
	assert.match(result.issue.title, /Cirkit/);
});

test("finds an issue by a distinctive part of its title", () => {
	const result = findIssue(issues, "Cirkit diagram");
	assert.equal(result.kind, "found");
	assert.equal(result.issue.id, "2026-09-02T13:35:03.1");
});

test("matches title text regardless of case or surrounding space", () => {
	const result = findIssue(issues, "  NETLIST.MD  ");
	assert.equal(result.kind, "found");
	assert.equal(result.issue.id, "2026-09-02T13:27:16.0");
});

test("reports ambiguity instead of guessing between two matches", () => {
	const result = findIssue(issues, "the");
	assert.equal(result.kind, "ambiguous");
	assert.equal(result.matches.length, 2);
});

test("reports not-found for text matching nothing", () => {
	assert.equal(findIssue(issues, "kubernetes").kind, "not-found");
});

test("reports not-found when there are no issues at all", () => {
	assert.equal(findIssue([], "anything").kind, "not-found");
});

test("distinguishes an already-closed issue from a missing one", () => {
	const closed = [{ ...open("ID-9", "already done thing"), status: "resolved" }];
	const result = findIssue(closed, "already done");
	assert.equal(result.kind, "already-closed");
	assert.equal(result.issue.status, "resolved");
});

test("prefers the open issue when an open and a closed one both match", () => {
	const mixed = [
		{ ...open("ID-OLD", "netlist work"), status: "resolved" },
		open("ID-NEW", "netlist work"),
	];
	const result = findIssue(mixed, "netlist work");
	assert.equal(result.kind, "found");
	assert.equal(result.issue.id, "ID-NEW");
});

test("an exact id beats a title substring that would otherwise be ambiguous", () => {
	const result = findIssue(issues, "2026-09-02T13:27:16.0");
	assert.equal(result.kind, "found");
	assert.equal(result.issue.id, "2026-09-02T13:27:16.0");
});
