/**
 * Resolve a human reference to a parked issue.
 *
 * Issue ids are timestamps and never appear in the rendered checklist, so the agent
 * can only cite an issue by the words the user just used. Matching therefore has to
 * accept a title fragment — but it must refuse to guess: closing the wrong item is
 * worse than asking which one was meant.
 */

import type { ParkedIssue } from "./model.ts";

/**
 * Dispatched work is still closable. Treating `in-progress` as closed would make
 * `close_parked_issue` refuse exactly the issues the agent was just sent to fix.
 */
function isClosable(issue: ParkedIssue): boolean {
	return issue.status === "open" || issue.status === "in-progress";
}

export type MatchResult =
	| { kind: "found"; issue: ParkedIssue }
	| { kind: "ambiguous"; matches: ParkedIssue[] }
	| { kind: "already-closed"; issue: ParkedIssue }
	| { kind: "not-found" };

export function findIssue(issues: readonly ParkedIssue[], query: string): MatchResult {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return { kind: "not-found" };

	// An id is unambiguous by construction, so it wins over any title text.
	const byId = issues.find((issue) => issue.id.toLowerCase() === needle);
	if (byId) return isClosable(byId) ? { kind: "found", issue: byId } : { kind: "already-closed", issue: byId };

	const matches = issues.filter((issue) => issue.title.toLowerCase().includes(needle));
	if (matches.length === 0) return { kind: "not-found" };

	// A closed issue with the same wording must not mask the open one still needing action.
	const openMatches = matches.filter(isClosable);
	if (openMatches.length === 1) return { kind: "found", issue: openMatches[0] };
	if (openMatches.length > 1) return { kind: "ambiguous", matches: openMatches };

	return { kind: "already-closed", issue: matches[0] };
}
