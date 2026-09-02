import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { choose } from "../src/ui/select.ts";

const theme = {
	fg: (_key, text) => text,
	bg: (_key, text) => text,
	bold: (text) => text,
};

/** Drive `choose` far enough to capture the overlay component it hands to Pi. */
function renderPopup(width, options) {
	let component;
	const ctx = {
		hasUI: true,
		ui: {
			// Must settle: `choose` serialises on a process-wide UI lock, so a
			// pending promise here would deadlock every later popup.
			custom(factory) {
				component = factory({}, theme, {}, () => {});
				return Promise.resolve(null);
			},
		},
	};

	void choose(ctx, options, [
		{ value: "park", label: "Park it", description: "Add to the backlog for later" },
		{ value: "discard", label: "Discard", description: "Not worth tracking" },
	]);

	return { render: () => component.render(width), component };
}

test("popup is drawn as a closed box at exactly the given width", async () => {
	const { render } = renderPopup(70, { title: "Park this medium issue?" });
	await new Promise((r) => setImmediate(r));

	const lines = render();
	for (const line of lines) {
		assert.equal(visibleWidth(line), 70, `line not 70 cols: ${JSON.stringify(line)}`);
	}
	assert.match(lines[0], /^╭/);
	assert.match(lines.at(-1), /╯$/);
});

test("popup shows its title in the frame and the body inside it", async () => {
	const { render } = renderPopup(70, {
		title: "Park this medium issue?",
		body: "docs/wiring/netlist.md — the designated source of truth",
	});
	await new Promise((r) => setImmediate(r));

	const text = render().join("\n");
	assert.ok(text.includes("Park this medium issue?"), "title rendered");
	assert.ok(text.includes("netlist.md"), "body rendered");
	assert.ok(text.includes("Park it"), "options rendered");
});

test("popup tells the user it is waiting for a keypress", async () => {
	const { render } = renderPopup(70, { title: "Park this?" });
	await new Promise((r) => setImmediate(r));

	const text = render().join("\n");
	assert.match(text, /Enter/, "hint names the accept key");
	assert.match(text, /Esc/, "hint names the cancel key");
});

test("popup wraps a body too long for one line instead of overflowing", async () => {
	const { render } = renderPopup(50, {
		title: "Park this?",
		body: "a ".repeat(120).trim(),
	});
	await new Promise((r) => setImmediate(r));

	for (const line of render()) {
		assert.equal(visibleWidth(line), 50);
	}
});

test("popup stays a closed box at an awkward narrow width", async () => {
	const { render } = renderPopup(20, { title: "Park this medium issue?", body: "some body text" });
	await new Promise((r) => setImmediate(r));

	const lines = render();
	for (const line of lines) {
		assert.equal(visibleWidth(line), 20);
	}
	assert.match(lines[0], /^╭/);
	assert.match(lines.at(-1), /╯$/);
});

test("choose returns null without a UI instead of drawing anything", async () => {
	assert.equal(await choose({ hasUI: false }, { title: "x" }, []), null);
});
