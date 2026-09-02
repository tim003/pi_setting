/**
 * Overlay selection popup.
 *
 * `ctx.ui.custom()` can only service one active call at a time, so every popup-style
 * tool in this Pi install has to serialize against every other one — not merely
 * against itself. `ask-user-question` parks a mutex on `globalThis` for exactly this
 * reason; we reuse that same key so the two extensions queue behind each other
 * instead of clobbering the screen.
 */

import { SelectList, type SelectItem, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { frame } from "./frame.ts";

const SHARED_UI_LOCK_KEY = "__piSharedUiLock";

/** Border padding, mirrored in the width maths below. */
const PADDING_X = 2;
const PADDING_Y = 1;

const HINT = "↑↓ navigate  •  Enter select  •  Esc cancel";

type UiLock = { withLock<T>(fn: () => T | Promise<T>): Promise<T> };

function getSharedUiLock(): UiLock {
	const globals = globalThis as Record<string, unknown>;
	if (!globals[SHARED_UI_LOCK_KEY]) {
		let chain: Promise<void> = Promise.resolve();
		globals[SHARED_UI_LOCK_KEY] = {
			withLock<T>(fn: () => T | Promise<T>): Promise<T> {
				const previous = chain;
				let release!: () => void;
				chain = new Promise<void>((resolve) => {
					release = resolve;
				});
				return previous.then(fn).finally(() => release());
			},
		} satisfies UiLock;
	}
	return globals[SHARED_UI_LOCK_KEY] as UiLock;
}

function selectListTheme(theme: any) {
	return {
		selectedPrefix: (text: string) => theme.fg("toolTitle", text),
		selectedText: (text: string) => theme.fg("toolTitle", text),
		description: (text: string) => theme.fg("dim", text),
		scrollInfo: (text: string) => theme.fg("dim", text),
		noMatch: (text: string) => theme.fg("muted", text),
	};
}

export interface PopupOptions {
	/** Short label drawn into the top border. */
	title: string;
	/** Longer text shown inside the box, above the choices. */
	body?: string;
	/** `high` paints the frame in the error colour; anything else uses the warning colour. */
	tone?: "high" | "normal";
}

/**
 * Show a titled, bordered list of choices as an overlay. Resolves to the chosen
 * value, or `null` when the user cancels or no UI is attached (headless child,
 * relay drop).
 */
export async function choose(
	ctx: any,
	options: PopupOptions,
	items: SelectItem[],
): Promise<string | null> {
	if (!ctx?.hasUI) return null;
	const { title, body, tone = "normal" } = options;

	return getSharedUiLock().withLock(() =>
		ctx.ui.custom<string | null>(
			(_tui: any, theme: any, _keybindings: any, done: (result: string | null) => void) => {
				const list = new SelectList(items, 8, selectListTheme(theme));
				list.onSelect = (item: SelectItem) => done(item.value);
				list.onCancel = () => done(null);

				const borderColor = tone === "high" ? "error" : "warning";
				return {
					render(width: number): string[] {
						// Two border columns plus the gutters the frame will add.
						const contentWidth = Math.max(1, width - 2 - PADDING_X * 2);

						const content: string[] = [];
						if (body) {
							for (const line of wrapTextWithAnsi(body, contentWidth)) {
								content.push(theme.fg("text", line));
							}
							content.push("");
						}
						content.push(...list.render(contentWidth));
						content.push("");
						content.push(theme.fg("dim", HINT));

						return frame(content, width, {
							title: theme.fg(borderColor, theme.bold(title)),
							paddingX: PADDING_X,
							paddingY: PADDING_Y,
							border: (text: string) => theme.fg(borderColor, text),
						});
					},
					handleInput(data: string): void {
						list.handleInput(data);
					},
				};
			},
			{ overlay: true },
		),
	);
}

/** Free-text follow-up for the "Other" choice. */
export async function askText(ctx: any, prompt: string): Promise<string | undefined> {
	if (!ctx?.hasUI) return undefined;
	const answer = await getSharedUiLock().withLock(() => ctx.ui.editor(prompt));
	const trimmed = typeof answer === "string" ? answer.trim() : "";
	return trimmed.length > 0 ? trimmed : undefined;
}
