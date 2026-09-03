/**
 * Parked-issue state model.
 *
 * State is event-sourced into the Pi session as custom entries and derived by
 * folding them. That is not ceremony: `pi.appendEntry` is append-only and
 * branch-local, so a fold over the current branch path gives `/tree` correctness
 * for free. Rewind the conversation and issues recorded on the abandoned branch
 * simply are not in the fold. Same mechanism observational memory uses.
 */

import type { Severity } from "./severity.ts";

export const PARKED_RECORDED = "parked.recorded";
export const PARKED_UPDATED = "parked.updated";

/**
 * `in-progress` is work handed to the agent but not finished. It exists because
 * marking an issue resolved at the moment it is dispatched would let the backlog
 * claim something is fixed when the turn ended halfway through it.
 */
export type IssueStatus = "open" | "in-progress" | "resolved" | "discarded";

export type ParkedIssue = {
	/** Timestamp id, assigned at capture. Stable across updates. */
	id: string;
	title: string;
	detail?: string;
	severity: Severity;
	status: IssueStatus;
	/** Lower sorts nearer the front. */
	priority: number;
	source: "agent" | "user";
};

/** Fields an update entry is allowed to change. `id` and `source` are immutable. */
const PATCHABLE = ["title", "detail", "severity", "status", "priority"] as const;

type Entry = { type?: string; customType?: string; data?: unknown };

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function isIssue(value: unknown): value is ParkedIssue {
	const record = asRecord(value);
	return typeof record?.id === "string" && typeof record?.title === "string";
}

/**
 * Fold ledger entries into current issue state. Entries from other extensions are
 * ignored, as are updates addressing an issue this branch never recorded.
 */
export function foldIssues(entries: readonly Entry[]): ParkedIssue[] {
	const byId = new Map<string, ParkedIssue>();

	for (const entry of entries) {
		if (entry?.type !== "custom") continue;
		const data = asRecord(entry.data);
		if (!data) continue;

		if (entry.customType === PARKED_RECORDED) {
			const issue = data.issue;
			// First valid record for an id wins, so a replayed entry cannot clobber updates.
			if (isIssue(issue) && !byId.has(issue.id)) byId.set(issue.id, { ...issue });
			continue;
		}

		if (entry.customType === PARKED_UPDATED) {
			const id = typeof data.id === "string" ? data.id : undefined;
			const existing = id ? byId.get(id) : undefined;
			if (!existing) continue;
			const next = { ...existing };
			for (const field of PATCHABLE) {
				if (data[field] !== undefined) (next as Record<string, unknown>)[field] = data[field];
			}
			byId.set(existing.id, next);
		}
	}

	return [...byId.values()];
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Severity first, then explicit priority, then id for a stable order. */
export function sortIssues(issues: readonly ParkedIssue[]): ParkedIssue[] {
	return [...issues].sort(
		(a, b) =>
			SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
			a.priority - b.priority ||
			a.id.localeCompare(b.id),
	);
}

/** Not yet started. This is what `Next` names and what a new session is told about. */
export function openIssues(issues: readonly ParkedIssue[]): ParkedIssue[] {
	return sortIssues(issues.filter((issue) => issue.status === "open"));
}

/**
 * Everything still outstanding, dispatched or not. The picker lists these: an issue
 * handed to the agent must stay reachable, or a stalled dispatch becomes a status
 * nothing can clear.
 */
export function activeIssues(issues: readonly ParkedIssue[]): ParkedIssue[] {
	return sortIssues(issues.filter((issue) => issue.status === "open" || issue.status === "in-progress"));
}
