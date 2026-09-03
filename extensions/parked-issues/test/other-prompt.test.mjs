import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import parkedIssues from "../index.ts";

/**
 * "Other…" used to rename the issue, which is a strange thing to want at the moment
 * a popup interrupts you: the natural reason to reach for it is to say what should
 * happen instead. It now hands the typed words to the agent as a real prompt, so the
 * user can steer rather than re-title.
 */
function setup({ choices = [], text, issues = [{ id: "ID-1", title: "netlist.md is missing" }] } = {}) {
	const entries = issues.map((issue) => ({
		type: "custom",
		customType: "parked.recorded",
		data: { issue: { severity: "medium", status: "open", priority: 100, source: "agent", ...issue } },
	}));

	const tools = new Map();
	const commands = new Map();
	const sent = [];
	const pi = {
		registerTool: (spec) => tools.set(spec.name, spec),
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
		ui: {
			custom: () => Promise.resolve(choices.shift() ?? null),
			editor: () => Promise.resolve(text),
		},
		sessionManager: {
			getBranch: () => entries,
			getCwd: () => mkdtempSync(join(tmpdir(), "parked-other-")),
		},
	};

	const recorded = () => entries.filter((e) => e.customType === "parked.recorded").map((e) => e.data.issue);
	const updates = () => entries.filter((e) => e.customType === "parked.updated").map((e) => e.data);
	return { tools, commands, ctx, sent, recorded, updates };
}

test("triage 'Other…' sends the typed words to the agent as a prompt", async () => {
	const { tools, ctx, sent } = setup({ choices: ["other"], text: "fix it now, before the netlist work" });

	await tools.get("park_issue").execute("call-1", { title: "Bench notes are stale", severity: "high" }, null, null, ctx);

	assert.equal(sent.length, 1, "expected exactly one user message");
	const text = typeof sent[0].content === "string" ? sent[0].content : JSON.stringify(sent[0].content);
	assert.match(text, /fix it now, before the netlist work/);
	assert.match(text, /Bench notes are stale/, "the prompt should name the issue it refers to");
});

test("triage 'Other…' keeps the issue and does not rename it", async () => {
	const { tools, ctx, recorded } = setup({ choices: ["other"], text: "just do it" });

	await tools.get("park_issue").execute("call-1", { title: "Bench notes are stale", severity: "high" }, null, null, ctx);

	const parked = recorded().find((issue) => issue.title === "Bench notes are stale");
	assert.ok(parked, "the issue must still be parked under its original title");
	assert.equal(parked.status, "open");
});

test("triage 'Other…' with no text parks the issue and sends nothing", async () => {
	const { tools, ctx, sent, recorded } = setup({ choices: ["other"], text: "   " });

	await tools.get("park_issue").execute("call-1", { title: "Bench notes are stale", severity: "high" }, null, null, ctx);

	assert.equal(sent.length, 0, "empty input must not trigger a turn");
	assert.ok(recorded().some((issue) => issue.title === "Bench notes are stale"));
});

test("/parked 'Other…' prompts the agent instead of retitling the issue", async () => {
	const { commands, ctx, sent, updates } = setup({
		choices: ["ID-1", "other"],
		text: "write the netlist from the SVGs",
	});

	await commands.get("parked").handler("", ctx);

	assert.equal(sent.length, 1);
	const text = typeof sent[0].content === "string" ? sent[0].content : JSON.stringify(sent[0].content);
	assert.match(text, /write the netlist from the SVGs/);
	assert.match(text, /netlist\.md is missing/, "the prompt should name the issue");
	assert.ok(
		!updates().some((update) => update.title !== undefined),
		"choosing Other must not rewrite the issue title",
	);
});

test("a user message is delivered as a follow-up so it never interleaves with tool calls", async () => {
	const { tools, ctx, sent } = setup({ choices: ["other"], text: "do it" });

	await tools.get("park_issue").execute("call-1", { title: "Bench notes are stale", severity: "high" }, null, null, ctx);

	assert.equal(sent[0].options?.deliverAs, "followUp");
});
