import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import parkedIssues from "../index.ts";

/**
 * The agent must be able to close an issue when the user says it is done. Without
 * this the only closing path is the interactive `/parked` popup, and an agent asked
 * to "abandon that" can do nothing but edit the derived ISSUES.md, which the next
 * sync overwrites.
 */
function setup({ answers = [], issues = [{ id: "ID-1", title: "netlist.md is missing" }] } = {}) {
	const entries = issues.map((issue) => ({
		type: "custom",
		customType: "parked.recorded",
		data: {
			issue: {
				severity: "medium",
				status: "open",
				priority: 100,
				source: "agent",
				...issue,
			},
		},
	}));

	const tools = new Map();
	const pi = {
		registerTool(spec) {
			tools.set(spec.name, spec);
		},
		registerCommand() {},
		registerEntryRenderer() {},
		on() {},
		appendEntry(customType, data) {
			entries.push({ type: "custom", customType, data });
		},
	};
	parkedIssues(pi);

	const prompts = [];
	const ctx = {
		hasUI: true,
		ui: {
			custom: () => {
				prompts.push("popup");
				return Promise.resolve(answers.shift() ?? null);
			},
		},
		sessionManager: {
			getBranch: () => entries,
			getCwd: () => mkdtempSync(join(tmpdir(), "parked-close-")),
		},
	};

	const updates = () => entries.filter((e) => e.customType === "parked.updated").map((e) => e.data);
	return { tools, ctx, prompts, updates };
}

const run = (tool, ctx, params) => tool.execute("call-1", params, undefined, () => {}, ctx);
const textOf = (result) => result.content.map((c) => c.text).join(" ");

test("registers a tool the agent can use to close an issue", () => {
	const { tools } = setup();
	assert.ok(tools.has("close_parked_issue"), `tools: ${[...tools.keys()].join(", ")}`);
});

test("resolving closes the issue directly, with no popup", async () => {
	const { tools, ctx, prompts, updates } = setup();

	const result = await run(tools.get("close_parked_issue"), ctx, {
		issue: "netlist.md",
		action: "resolve",
	});

	assert.deepEqual(updates(), [{ id: "ID-1", status: "resolved" }]);
	assert.equal(prompts.length, 0, "resolving must not interrupt the user");
	assert.match(textOf(result), /resolved/i);
});

test("discarding asks first and closes once approved", async () => {
	const { tools, ctx, prompts, updates } = setup({ answers: ["discard"] });

	await run(tools.get("close_parked_issue"), ctx, { issue: "netlist.md", action: "discard" });

	assert.equal(prompts.length, 1, "discard must confirm before dropping the issue");
	assert.deepEqual(updates(), [{ id: "ID-1", status: "discarded" }]);
});

test("a declined discard leaves the issue open", async () => {
	const { tools, ctx, updates } = setup({ answers: ["keep"] });

	const result = await run(tools.get("close_parked_issue"), ctx, {
		issue: "netlist.md",
		action: "discard",
	});

	assert.deepEqual(updates(), [], "nothing may be recorded when the user declines");
	assert.match(textOf(result), /kept|declin|cancel/i);
});

test("an unknown reference changes nothing and says so", async () => {
	const { tools, ctx, updates } = setup();

	const result = await run(tools.get("close_parked_issue"), ctx, {
		issue: "something never parked",
		action: "resolve",
	});

	assert.deepEqual(updates(), []);
	assert.match(textOf(result), /no (open )?parked issue|not found/i);
});

test("an ambiguous reference refuses and lists the candidates", async () => {
	const { tools, ctx, updates } = setup({
		issues: [
			{ id: "ID-1", title: "netlist wiring pass" },
			{ id: "ID-2", title: "netlist power pass" },
		],
	});

	const result = await run(tools.get("close_parked_issue"), ctx, {
		issue: "netlist",
		action: "resolve",
	});

	assert.deepEqual(updates(), [], "must not guess between candidates");
	const text = textOf(result);
	assert.ok(text.includes("ID-1") && text.includes("ID-2"), `should list ids: ${text}`);
});

test("closing an already-closed issue is reported, not repeated", async () => {
	const { tools, ctx, updates } = setup();
	const tool = tools.get("close_parked_issue");

	await run(tool, ctx, { issue: "netlist.md", action: "resolve" });
	const result = await run(tool, ctx, { issue: "netlist.md", action: "resolve" });

	assert.equal(updates().length, 1, "second close must not append a duplicate update");
	assert.match(textOf(result), /already/i);
});

test("closing works headlessly for resolve, and skips discard without a UI", async () => {
	const { tools, ctx, updates } = setup();
	ctx.hasUI = false;

	await run(tools.get("close_parked_issue"), ctx, { issue: "netlist.md", action: "resolve" });
	assert.deepEqual(updates(), [{ id: "ID-1", status: "resolved" }]);
});
