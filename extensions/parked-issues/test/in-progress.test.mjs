import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import parkedIssues from "../index.ts";
import { foldIssues, openIssues, activeIssues } from "../src/model.ts";
import { findIssue } from "../src/match.ts";
import { renderChecklist } from "../src/store.ts";

/**
 * Dispatching an issue to the agent used to mean typing the instruction by hand.
 * The menu now sends it, which needs a status between open and resolved: work that
 * has been handed over but not finished is neither.
 */

function issue(overrides) {
	return {
		id: "ID-1",
		title: "an issue",
		severity: "medium",
		status: "open",
		priority: 100,
		source: "agent",
		...overrides,
	};
}

function recorded(...issues) {
	return issues.map((data) => ({ type: "custom", customType: "parked.recorded", data: { issue: data } }));
}

function updated(data) {
	return { type: "custom", customType: "parked.updated", data };
}

// ------------------------------------------------------------------ model

test("an update can move an issue into in-progress", () => {
	const folded = foldIssues([...recorded(issue({})), updated({ id: "ID-1", status: "in-progress" })]);
	assert.equal(folded[0].status, "in-progress");
});

test("openIssues means not yet started, so it excludes in-progress", () => {
	const folded = foldIssues([
		...recorded(issue({ id: "A" }), issue({ id: "B" })),
		updated({ id: "B", status: "in-progress" }),
	]);
	assert.deepEqual(openIssues(folded).map((i) => i.id), ["A"]);
});

test("activeIssues covers everything not yet closed", () => {
	const folded = foldIssues([
		...recorded(
			issue({ id: "A", severity: "low" }),
			issue({ id: "B", severity: "high" }),
			issue({ id: "C" }),
			issue({ id: "D" }),
		),
		updated({ id: "B", status: "in-progress" }),
		updated({ id: "C", status: "resolved" }),
		updated({ id: "D", status: "discarded" }),
	]);
	assert.deepEqual(activeIssues(folded).map((i) => i.id), ["B", "A"], "expected severity order, closed excluded");
});

// ------------------------------------------------------------------ match

test("an in-progress issue can still be closed by id", () => {
	const folded = foldIssues([...recorded(issue({})), updated({ id: "ID-1", status: "in-progress" })]);
	const result = findIssue(folded, "ID-1");
	assert.equal(result.kind, "found", "dispatched work must remain closable");
});

test("an in-progress issue is preferred over a closed one with the same wording", () => {
	const folded = foldIssues([
		...recorded(issue({ id: "OLD", title: "netlist is missing" }), issue({ id: "NEW", title: "netlist is missing" })),
		updated({ id: "OLD", status: "resolved" }),
		updated({ id: "NEW", status: "in-progress" }),
	]);
	const result = findIssue(folded, "netlist");
	assert.equal(result.kind, "found");
	assert.equal(result.issue.id, "NEW");
});

// ------------------------------------------------------------------ store

test("the checklist gives in-progress work its own section", () => {
	const folded = foldIssues([...recorded(issue({ title: "wire the guard" })), updated({ id: "ID-1", status: "in-progress" })]);
	const markdown = renderChecklist(folded);
	assert.match(markdown, /## In progress/);
	assert.match(markdown, /- \[~\] .*wire the guard/);
});

test("Next names the top open issue, never one already dispatched", () => {
	const folded = foldIssues([
		...recorded(issue({ id: "A", severity: "high", title: "dispatched one" }), issue({ id: "B", title: "waiting one" })),
		updated({ id: "A", status: "in-progress" }),
	]);
	assert.match(renderChecklist(folded), /_Next: waiting one_/);
});

test("a backlog of only in-progress work is not reported as empty", () => {
	const folded = foldIssues([...recorded(issue({})), updated({ id: "ID-1", status: "in-progress" })]);
	assert.doesNotMatch(renderChecklist(folded), /No parked issues/);
});

// ----------------------------------------------------------------- wiring

function setup({ choices = [], issues = [{ id: "ID-1", title: "netlist.md is missing" }] } = {}) {
	const entries = issues.map((data) => ({
		type: "custom",
		customType: "parked.recorded",
		data: { issue: { severity: "medium", status: "open", priority: 100, source: "agent", ...data } },
	}));

	const commands = new Map();
	const sent = [];
	const pi = {
		registerTool() {},
		registerCommand: (name, spec) => commands.set(name, spec),
		registerEntryRenderer() {},
		on() {},
		appendEntry(customType, data) {
			entries.push({ type: "custom", customType, data });
		},
		sendUserMessage(content, options) {
			sent.push({ content, options });
		},
	};
	parkedIssues(pi);

	const ctx = {
		hasUI: true,
		ui: { custom: () => Promise.resolve(choices.shift() ?? null) },
		sessionManager: {
			getBranch: () => entries,
			getCwd: () => mkdtempSync(join(tmpdir(), "parked-progress-")),
		},
	};

	const updates = () => entries.filter((e) => e.customType === "parked.updated").map((e) => e.data);
	return { commands, ctx, sent, updates };
}

test("working on one issue marks it in-progress and hands it to the agent", async () => {
	const { commands, ctx, sent, updates } = setup({ choices: ["ID-1", "work"] });

	await commands.get("parked").handler("", ctx);

	assert.deepEqual(
		updates().filter((u) => u.status === "in-progress").map((u) => u.id),
		["ID-1"],
	);
	assert.equal(sent.length, 1, "expected one dispatch to the agent");
	assert.equal(sent[0].options?.deliverAs, "followUp");
	assert.match(sent[0].content, /ID-1/, "the agent needs the id to close it");
	assert.match(sent[0].content, /netlist\.md is missing/);
	assert.match(sent[0].content, /close_parked_issue/, "the agent must be told how to close it");
});

test("working on all issues dispatches them in one message", async () => {
	const { commands, ctx, sent, updates } = setup({
		choices: ["__all__"],
		issues: [
			{ id: "A", title: "first thing", severity: "high" },
			{ id: "B", title: "second thing" },
		],
	});

	await commands.get("parked").handler("", ctx);

	assert.deepEqual(
		updates().filter((u) => u.status === "in-progress").map((u) => u.id).sort(),
		["A", "B"],
	);
	assert.equal(sent.length, 1, "expected a single combined dispatch");
	assert.match(sent[0].content, /first thing/);
	assert.match(sent[0].content, /second thing/);
});

test("an issue already dispatched still appears in the picker", async () => {
	const { commands, ctx } = setup({ choices: [null] });
	let offered = [];
	ctx.ui.custom = (render) => {
		// The picker builds its rows before rendering; capture them via the select items.
		offered.push(render);
		return Promise.resolve(null);
	};

	const withProgress = setup({
		choices: ["ID-1", "back-to-open"],
		issues: [{ id: "ID-1", title: "stalled work" }],
	});
	withProgress.ctx.sessionManager.getBranch().push({
		type: "custom",
		customType: "parked.updated",
		data: { id: "ID-1", status: "in-progress" },
	});

	await withProgress.commands.get("parked").handler("", withProgress.ctx);

	assert.deepEqual(
		withProgress.updates().filter((u) => u.status === "open").map((u) => u.id),
		["ID-1"],
		"an in-progress issue must be reachable and resettable",
	);
});
