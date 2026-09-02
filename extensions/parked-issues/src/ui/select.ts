/**
 * Overlay selection popup.
 *
 * `ctx.ui.custom()` can only service one active call at a time, so every popup-style
 * tool in this Pi install has to serialize against every other one — not merely
 * against itself. `ask-user-question` parks a mutex on `globalThis` for exactly this
 * reason; we reuse that same key so the two extensions queue behind each other
 * instead of clobbering the screen.
 */

import { SelectList, type SelectItem } from "@earendil-works/pi-tui";

const SHARED_UI_LOCK_KEY = "__piSharedUiLock";

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

/**
 * Show a headed list of choices as an overlay. Resolves to the chosen value, or
 * `null` when the user cancels or no UI is attached (headless child, relay drop).
 */
export async function choose(ctx: any, header: string, items: SelectItem[]): Promise<string | null> {
	if (!ctx?.hasUI) return null;

	return getSharedUiLock().withLock(() =>
		ctx.ui.custom<string | null>(
			(_tui: any, theme: any, _keybindings: any, done: (result: string | null) => void) => {
				const list = new SelectList(items, 8, selectListTheme(theme));
				list.onSelect = (item: SelectItem) => done(item.value);
				list.onCancel = () => done(null);
				return {
					render(width: number): string[] {
						return [theme.fg("toolTitle", theme.bold(header)), "", ...list.render(width)];
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
