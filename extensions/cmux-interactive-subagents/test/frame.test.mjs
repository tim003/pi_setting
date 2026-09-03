import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { frame } from "../src/ui/frame.ts";

const RED = "\u001b[31m";
const RESET = "\u001b[0m";

test("every framed line is exactly the requested width", () => {
	const lines = frame(["short", "a much longer content line here"], 40, { title: "Park this?" });
	for (const line of lines) {
		assert.equal(visibleWidth(line), 40, `line not 40 cols: ${JSON.stringify(line)}`);
	}
});

test("draws a closed border with the title in the top edge", () => {
	const lines = frame(["body"], 40, { title: "Park this?" });
	assert.match(lines[0], /^╭/, "top-left corner");
	assert.match(lines[0], /╮$/, "top-right corner");
	assert.ok(lines[0].includes("Park this?"), "title sits in the top edge");
	assert.match(lines.at(-1), /^╰/, "bottom-left corner");
	assert.match(lines.at(-1), /╯$/, "bottom-right corner");
	for (const line of lines.slice(1, -1)) {
		assert.match(line, /^│/, "left edge");
		assert.match(line, /│$/, "right edge");
	}
});

test("puts blank padding rows above and below the content", () => {
	const lines = frame(["body"], 40, { title: "T", paddingY: 1 });
	const inner = lines.slice(1, -1);
	assert.equal(inner.length, 3, "one content row between two padding rows");
	assert.equal(inner[0].replace(/[│]/g, "").trim(), "", "blank row above content");
	assert.equal(inner.at(-1).replace(/[│]/g, "").trim(), "", "blank row below content");
	assert.ok(inner[1].includes("body"));
});

test("indents content away from the left edge", () => {
	const lines = frame(["body"], 40, { title: "T", paddingX: 2 });
	const contentLine = lines.find((l) => l.includes("body"));
	assert.match(contentLine, /^│ {2}body/, "content is inset by paddingX");
});

test("truncates content that would overflow the frame", () => {
	const lines = frame(["x".repeat(200)], 30, { title: "T" });
	for (const line of lines) {
		assert.equal(visibleWidth(line), 30);
	}
});

test("keeps geometry when content carries ANSI colour codes", () => {
	const colored = `${RED}colored body${RESET}`;
	const lines = frame([colored], 40, { title: "T" });
	for (const line of lines) {
		assert.equal(visibleWidth(line), 40, "ANSI codes must not count as width");
	}
	assert.ok(lines.some((l) => l.includes("colored body")));
});

test("truncates a title that cannot fit the top edge", () => {
	const lines = frame(["body"], 24, { title: "a very long title that will not fit at all" });
	assert.equal(visibleWidth(lines[0]), 24);
	assert.match(lines[0], /^╭/);
	assert.match(lines[0], /╮$/);
});

test("applies the border colour only to frame characters", () => {
	const lines = frame(["body"], 30, { title: "T", border: (s) => `${RED}${s}${RESET}` });
	assert.ok(lines[0].includes(RED), "top edge is colourised");
	assert.equal(visibleWidth(lines[0]), 30, "colour must not change geometry");
	const contentLine = lines.find((l) => l.includes("body"));
	assert.ok(!contentLine.replace(/\u001b\[[0-9;]*m/g, "").includes("["), "content stays clean");
});

test("survives widths too small to draw a frame", () => {
	for (const width of [0, 1, 2, 3, 4]) {
		const lines = frame(["body"], width, { title: "T" });
		for (const line of lines) {
			assert.ok(visibleWidth(line) <= Math.max(0, width), `overflowed at width ${width}`);
		}
	}
});
