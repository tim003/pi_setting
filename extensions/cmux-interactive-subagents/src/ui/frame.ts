/**
 * Draws a bordered, padded box around pre-rendered lines.
 *
 * The popup previously rendered as bare text on the overlay's background, which
 * against a dark terminal reads as a frozen screen rather than a prompt. A closed
 * bright border plus breathing room around the content makes it unmistakably a
 * modal waiting on input.
 *
 * Width is measured with `visibleWidth`, never `String.length`: SelectList hands us
 * ANSI-coloured lines, and counting escape bytes as columns would tear the frame.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const TOP_LEFT = "╭";
const TOP_RIGHT = "╮";
const BOTTOM_LEFT = "╰";
const BOTTOM_RIGHT = "╯";
const HORIZONTAL = "─";
const VERTICAL = "│";

/** Smallest width that can still hold two borders and one content column. */
const MIN_FRAMEABLE_WIDTH = 3;

export interface FrameOptions {
	/** Shown inside the top edge. Pre-style it if you want colour; it is truncated to fit. */
	title?: string;
	/** Blank columns between the vertical borders and the content. */
	paddingX?: number;
	/** Blank rows between the horizontal borders and the content. */
	paddingY?: number;
	/** Applied to border glyphs only, so content keeps its own styling. */
	border?: (text: string) => string;
}

export function frame(lines: string[], width: number, options: FrameOptions = {}): string[] {
	const { title = "", paddingX = 2, paddingY = 1, border = (text: string) => text } = options;

	// Nothing sensible to draw in a sliver of a terminal; degrade to plain text
	// rather than emitting rows wider than the viewport.
	if (width < MIN_FRAMEABLE_WIDTH) {
		return lines.map((line) => truncateToWidth(line, Math.max(0, width), ""));
	}

	const innerWidth = width - 2;
	// Clamp padding so a narrow frame keeps at least one content column.
	const padX = Math.max(0, Math.min(paddingX, Math.floor((innerWidth - 1) / 2)));
	const contentWidth = Math.max(1, innerWidth - padX * 2);
	const gutter = " ".repeat(padX);

	const blankRow = border(VERTICAL) + " ".repeat(innerWidth) + border(VERTICAL);
	const contentRow = (line: string) =>
		border(VERTICAL) +
		gutter +
		truncateToWidth(line, contentWidth, "…", true) +
		gutter +
		border(VERTICAL);

	const framed: string[] = [buildTopEdge(title, innerWidth, border)];
	for (let i = 0; i < paddingY; i++) framed.push(blankRow);
	for (const line of lines) framed.push(contentRow(line));
	for (let i = 0; i < paddingY; i++) framed.push(blankRow);
	framed.push(border(BOTTOM_LEFT + HORIZONTAL.repeat(innerWidth) + BOTTOM_RIGHT));

	return framed;
}

/** `╭─ Title ────────╮`, falling back to a plain edge when the title cannot fit. */
function buildTopEdge(title: string, innerWidth: number, border: (text: string) => string): string {
	// "─", a space either side of the title, and at least one trailing "─".
	const decorationWidth = 4;
	const maxTitleWidth = innerWidth - decorationWidth;

	if (title.length === 0 || maxTitleWidth < 1) {
		return border(TOP_LEFT + HORIZONTAL.repeat(innerWidth) + TOP_RIGHT);
	}

	const fitted = truncateToWidth(title, maxTitleWidth, "…");
	const fill = Math.max(0, innerWidth - visibleWidth(fitted) - 3);

	return (
		border(TOP_LEFT + HORIZONTAL + " ") +
		fitted +
		border(" " + HORIZONTAL.repeat(fill) + TOP_RIGHT)
	);
}
