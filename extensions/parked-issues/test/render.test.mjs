import test from "node:test";
import assert from "node:assert/strict";
import parkedIssues from "../index.ts";

/**
 * Guards the renderer's argument arity. Pi calls entry renderers as
 * (entry, { expanded }, theme) -- getting that wrong fails only at render
 * time, inside a catch that degrades to "renderer failed: ...", so no amount
 * of loading or calling the tool surfaces it.
 */
const theme = {
	fg: (_key, text) => text,
	bg: (_key, text) => text,
	bold: (text) => text,
};

function loadExtension() {
	const renderers = new Map();
	const pi = {
		registerTool() {},
		registerCommand() {},
		registerEntryRenderer(type, renderer) {
			renderers.set(type, renderer);
		},
		on() {},
		appendEntry() {},
	};
	parkedIssues(pi);
	return renderers;
}

test("registers a renderer for its checklist entry", () => {
	assert.ok(loadExtension().has("parked.checklist"));
});

test("checklist renderer accepts Pi's (entry, options, theme) arguments", () => {
	const renderer = loadExtension().get("parked.checklist");
	const entry = { data: { markdown: "# Parked issues\n\n- [ ] `low` something" } };

	const component = renderer(entry, { expanded: false }, theme);
	assert.ok(component, "renderer should return a component");
});

test("checklist renderer survives an entry with no markdown", () => {
	const renderer = loadExtension().get("parked.checklist");
	assert.ok(renderer({ data: {} }, { expanded: false }, theme));
	assert.ok(renderer({}, { expanded: true }, theme));
});
