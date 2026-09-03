/**
 * parked-issues — capture side suggestions without derailing the conversation.
 *
 * Flow:
 *   1. The agent calls `park_issue` instead of interrupting with a tangent.
 *   2. `escalate()` applies a hard severity floor over the agent's judgment.
 *   3. High severity prompts immediately; everything else queues silently and is
 *      triaged in one batch at `turn_end`.
 *   4. Nothing is recorded without the user's say-so, so the backlog cannot rot
 *      into a junk drawer of unreviewed agent chatter.
 *
 * State is folded from the active branch (`getBranch()`, not `getEntries()`), which
 * is what keeps the list correct under `/tree`: issues recorded on an abandoned
 * branch are simply absent from the fold.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { findIssue } from "./src/match.ts";
import {
	PARKED_RECORDED,
	PARKED_UPDATED,
	activeIssues,
	foldIssues,
	openIssues,
	type ParkedIssue,
} from "./src/model.ts";
import { escalate, type Severity } from "./src/severity.ts";
import { renderChecklist, writeIssuesFile } from "./src/store.ts";
import { askText, choose } from "./src/ui/select.ts";

const CHECKLIST_ENTRY = "parked.checklist";

/** Sentinel row value; cannot collide with an id, which is always a timestamp. */
const ALL = "__all__";

const ParkIssueParams = Type.Object({
	title: Type.String({
		description: "One-line statement of the unresolved issue or deferred suggestion.",
	}),
	detail: Type.Optional(
		Type.String({ description: "Optional short note on why it matters or what to do about it." }),
	),
	severity: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")], {
		description:
			"high = safety, data loss, security, or destructive operations (interrupts the user immediately). medium = a real follow-up worth doing. low = a minor or speculative idea.",
	}),
});

const CloseIssueParams = Type.Object({
	issue: Type.String({
		description:
			"Which issue to close: its id, or a distinctive phrase from its title. Must identify exactly one outstanding issue, whether open or already in progress.",
	}),
	action: Type.Union([Type.Literal("resolve"), Type.Literal("discard")], {
		description:
			"resolve = the work is done. discard = drop it without doing it (the user is asked to confirm).",
	}),
});

let nextDisambiguator = 0;
function newIssueId(): string {
	const stamp = new Date().toISOString().replace(/\..*$/, "");
	return `${stamp}.${(nextDisambiguator++).toString(36)}`;
}

export default function parkedIssues(pi: ExtensionAPI) {
	/** Items noticed this turn, awaiting batched triage at turn_end. */
	const pending: ParkedIssue[] = [];

	const currentIssues = (ctx: any): ParkedIssue[] => {
		try {
			return foldIssues(ctx?.sessionManager?.getBranch?.() ?? []);
		} catch {
			return [];
		}
	};

	const syncBacklog = (ctx: any): ParkedIssue[] => {
		const issues = currentIssues(ctx);
		try {
			const root = ctx?.sessionManager?.getCwd?.();
			if (root) writeIssuesFile(root, issues);
		} catch {
			// A read-only or missing project root must never break a turn.
		}
		return issues;
	};

	/**
	 * Hand the user's words to the agent as a real prompt.
	 *
	 * The issue is named so the agent knows what "it" refers to — the popup text is
	 * not in the conversation, so an instruction like "just fix it" would otherwise
	 * arrive with no referent. Delivered as a follow-up so it lands after the current
	 * tool calls finish rather than interleaving with them.
	 */
	const promptAgent = (issue: ParkedIssue, text: string): void => {
		pi.sendUserMessage?.(`Parked issue "${issue.title}" (${issue.id}): ${text}`, { deliverAs: "followUp" });
	};

	/**
	 * Hand issues to the agent and mark them in-progress.
	 *
	 * Ids travel with the titles because the agent closes issues by reference, and
	 * titles alone go ambiguous as soon as two issues touch the same file. Closing is
	 * left to the agent on completion: marking them resolved here would record work as
	 * done at the moment it was merely started.
	 */
	const dispatchWork = (issues: readonly ParkedIssue[]): void => {
		if (issues.length === 0) return;
		for (const issue of issues) pi.appendEntry(PARKED_UPDATED, { id: issue.id, status: "in-progress" });

		const list = issues
			.map((issue) => `- (${issue.id}) [${issue.severity}] ${issue.title}${issue.detail ? `\n      ${issue.detail}` : ""}`)
			.join("\n");
		const header =
			issues.length === 1
				? "Work on this parked issue now:"
				: `Work through these ${issues.length} parked issues, in the order listed:`;

		pi.sendUserMessage?.(
			`${header}\n\n${list}\n\n` +
				"Close each one with the close_parked_issue tool when its work is genuinely done. " +
				"If you cannot finish one, say so and leave it in progress rather than closing it.",
			{ deliverAs: "followUp" },
		);
	};

	/** Ask the user what to do with a freshly noticed item. */
	async function triage(ctx: any, issue: ParkedIssue): Promise<void> {
		const action = await choose(
			ctx,
			{
				title: `Park this ${issue.severity} issue?`,
				body: issue.detail ? `${issue.title}\n${issue.detail}` : issue.title,
				tone: issue.severity === "high" ? "high" : "normal",
			},
			[
				{ value: "park", label: "Park it", description: "Add to the backlog for later" },
				{ value: "front", label: "Park at the front", description: "Do this next" },
				{ value: "discard", label: "Discard", description: "Not worth tracking" },
				{ value: "other", label: "Other…", description: "Tell me what to do about it" },
			],
		);

		// Cancelled or headless: keep the item rather than silently losing it.
		if (action === null) {
			pi.appendEntry(PARKED_RECORDED, { issue });
			return;
		}
		if (action === "discard") return;

		let recorded = issue;
		if (action === "front") recorded = { ...issue, priority: 0 };

		// Keep the issue either way: the typed text steers the agent, it does not
		// replace the record, so cancelling the prompt still leaves the item parked.
		const instruction = action === "other" ? await askText(ctx, `What should happen to this issue?\n\n${issue.title}`) : undefined;

		pi.appendEntry(PARKED_RECORDED, { issue: recorded });
		if (instruction) promptAgent(recorded, instruction);
	}

	pi.registerTool({
		name: "park_issue",
		label: "park_issue",
		description:
			"Record a side issue, tangent, or unresolved thread instead of interrupting the current task with it. Use this whenever you notice something worth raising that is not what the user asked about right now.",
		promptSnippet:
			"Park side suggestions with park_issue instead of derailing the current task; the user triages them at the end of the turn.",
		promptGuidelines: [
			"Call park_issue instead of appending unrelated suggestions to your answer.",
			"Use severity high only for safety, security, data loss, or destructive operations.",
			"Keep the title to one line stating the issue, not a paragraph of reasoning.",
			"Do not re-park an issue that is already in the backlog.",
		],
		parameters: ParkIssueParams,

		async execute(_toolCallId, params: any, _signal, _onUpdate, ctx: any) {
			const severity = escalate(`${params.title} ${params.detail ?? ""}`, params.severity as Severity);
			const issue: ParkedIssue = {
				id: newIssueId(),
				title: params.title,
				detail: params.detail,
				severity,
				status: "open",
				priority: severity === "high" ? 0 : 100,
				source: "agent",
			};

			// High severity is the whole point of the escalation floor: it interrupts now.
			if (severity === "high") {
				await triage(ctx, issue);
				syncBacklog(ctx);
				return { content: [{ type: "text", text: `Raised immediately (${severity}): ${issue.title}` }] };
			}

			pending.push(issue);
			return {
				content: [
					{ type: "text", text: `Queued for end-of-turn triage (${severity}): ${issue.title}` },
				],
			};
		},

		renderCall(args: any, theme: any) {
			return new Text(
				theme.fg("toolTitle", theme.bold("park_issue ")) + theme.fg("muted", String(args.title ?? "")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "close_parked_issue",
		label: "close_parked_issue",
		description:
			"Close a parked issue once it is finished or no longer wanted. Use this instead of editing .parked/ISSUES.md, which is generated from the session and will overwrite any manual edit.",
		promptGuidelines: [
			"Close a parked issue as soon as the user says it is done, resolved, or should be abandoned.",
			"Use resolve when the work was actually completed; use discard to drop an issue unaddressed.",
			"Never close an issue the user still expects work on.",
			"Identify the issue by a distinctive phrase from its title rather than guessing an id.",
		],
		parameters: CloseIssueParams,

		async execute(_toolCallId, params: any, _signal, _onUpdate, ctx: any) {
			const say = (text: string) => ({ content: [{ type: "text" as const, text }] });
			const match = findIssue(currentIssues(ctx), params.issue);

			if (match.kind === "not-found") {
				// Includes dispatched work: hiding it here would be worst exactly when the
				// agent was sent to close it and got the wording slightly wrong.
				const outstanding = activeIssues(currentIssues(ctx));
				const listing =
					outstanding.length > 0
						? ` Outstanding issues: ${outstanding.map((issue) => `${issue.id} — ${issue.title}`).join("; ")}`
						: " The backlog is empty for this session.";
				return say(`No parked issue matches "${params.issue}".${listing}`);
			}

			if (match.kind === "ambiguous") {
				const candidates = match.matches.map((issue) => `${issue.id} — ${issue.title}`).join("; ");
				return say(
					`"${params.issue}" matches ${match.matches.length} outstanding issues, so nothing was closed. Name one exactly: ${candidates}`,
				);
			}

			if (match.kind === "already-closed") {
				return say(`Already ${match.issue.status}: ${match.issue.title}`);
			}

			const issue = match.issue;

			// Resolving records completed work, so it goes through silently. Discarding
			// drops an issue nobody actioned, which is the destructive one — ask first.
			if (params.action === "discard") {
				const answer = await choose(
					ctx,
					{ title: "Discard this parked issue?", body: issue.title },
					[
						{ value: "discard", label: "Discard it", description: "Drop it from the backlog" },
						{ value: "keep", label: "Keep it", description: "Leave it open for later" },
					],
				);
				if (answer !== "discard") return say(`Kept (discard declined): ${issue.title}`);
			}

			const status = params.action === "discard" ? "discarded" : "resolved";
			pi.appendEntry(PARKED_UPDATED, { id: issue.id, status });
			syncBacklog(ctx);
			return say(`Marked ${status}: ${issue.title}`);
		},

		renderCall(args: any, theme: any) {
			return new Text(
				theme.fg("toolTitle", theme.bold("close_parked_issue ")) +
					theme.fg("muted", `${args.action ?? ""} ${args.issue ?? ""}`.trim()),
				0,
				0,
			);
		},
	});

	pi.on("turn_end", async (_event, ctx: any) => {
		if (pending.length === 0) return;
		const batch = pending.splice(0, pending.length);
		try {
			for (const issue of batch) await triage(ctx, issue);
			syncBacklog(ctx);
		} catch {
			// Never let triage failures break the turn.
		}
	});

	pi.registerCommand("parked", {
		description: "Review and triage parked issues",
		handler: async (_args: string, ctx: any) => {
			const issues = syncBacklog(ctx);
			// Dispatched work stays listed, so a stalled hand-off can be reset rather than
			// stranded in a status the menu cannot reach.
			const active = activeIssues(issues);
			const open = openIssues(issues);

			if (active.length > 0) {
				const rows = active.map((issue) => ({
					value: issue.id,
					label: `${issue.status === "in-progress" ? "~" : " "} ${issue.severity}  ${issue.title}`,
					description: issue.detail,
				}));
				if (open.length > 1) {
					rows.unshift({
						value: ALL,
						label: `▶ Work on all ${open.length} now`,
						description: "Hand every open issue to me in one go",
					});
				}

				const picked = await choose(
					ctx,
					{ title: `Parked issues (${active.length}) — pick one to act on` },
					rows,
				);

				if (picked === ALL) {
					dispatchWork(open);
				} else if (picked) {
					const issue = active.find((candidate) => candidate.id === picked);
					const actions = [
						{ value: "work", label: "Work on it now", description: "Hand it to me and mark it in progress" },
						{ value: "resolve", label: "Mark resolved", description: "Close it without doing anything" },
						{ value: "front", label: "Move to the front" },
						{ value: "discard", label: "Discard" },
						{ value: "other", label: "Other…", description: "Tell me what to do about it" },
					];
					if (issue?.status === "in-progress") {
						actions.splice(1, 0, {
							value: "back-to-open",
							label: "Back to open",
							description: "It stalled; put it back in the queue",
						});
					}

					const action = await choose(ctx, { title: "What should happen to it?" }, actions);

					if (action === "work" && issue) dispatchWork([issue]);
					if (action === "resolve") pi.appendEntry(PARKED_UPDATED, { id: picked, status: "resolved" });
					if (action === "discard") pi.appendEntry(PARKED_UPDATED, { id: picked, status: "discarded" });
					if (action === "front") pi.appendEntry(PARKED_UPDATED, { id: picked, priority: 0 });
					if (action === "back-to-open") pi.appendEntry(PARKED_UPDATED, { id: picked, status: "open" });
					if (action === "other") {
						const text = issue ? await askText(ctx, `What should happen to this issue?\n\n${issue.title}`) : undefined;
						if (issue && text) promptAgent(issue, text);
					}
				}
			}

			// Model-free: derived wholly from state, so it costs nothing and cannot invent a task.
			pi.appendEntry(CHECKLIST_ENTRY, { markdown: renderChecklist(syncBacklog(ctx)) });
		},
	});

	// Pi calls entry renderers as (entry, { expanded }, theme) — the options object
	// sits between the entry and the theme.
	pi.registerEntryRenderer(CHECKLIST_ENTRY, (entry: any, _options: any, theme: any) => {
		const markdown = String(entry?.data?.markdown ?? "");
		return new Text(theme.fg("muted", markdown), 0, 0);
	});
}
