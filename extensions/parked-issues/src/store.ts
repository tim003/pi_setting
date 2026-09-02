/**
 * Durable tier: the project-level backlog at `<project>/.parked/ISSUES.md`.
 *
 * Rooted at the session's cwd, exactly like observational memory's `.memory/`, so
 * the backlog follows the work rather than the machine. Unlike `.memory/` there is
 * no per-session subfolder: the whole point of this tier is to accumulate across
 * sessions once the branch-local ledger is gone.
 *
 * `renderChecklist` is model-free. Everything it reports — what is resolved, what
 * is open, what comes next — is derivable from state, so it costs no tokens and
 * cannot hallucinate a task that was never parked.
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { openIssues, sortIssues, type ParkedIssue } from "./model.ts";

export const PARKED_DIR = ".parked";
export const ISSUES_FILE = "ISSUES.md";

export function issuesFilePath(projectRoot: string): string {
	return join(projectRoot, PARKED_DIR, ISSUES_FILE);
}

function renderItem(issue: ParkedIssue, box: string): string {
	const detail = issue.detail ? ` — ${issue.detail}` : "";
	return `- [${box}] \`${issue.severity}\` ${issue.title}${detail}`;
}

/** Deterministic checklist of backlog state. Discarded issues are omitted. */
export function renderChecklist(issues: readonly ParkedIssue[]): string {
	const open = openIssues(issues);
	const resolved = sortIssues(issues.filter((issue) => issue.status === "resolved"));

	if (open.length === 0 && resolved.length === 0) return "# Parked issues\n\nNo parked issues.\n";

	const lines = ["# Parked issues", ""];
	if (open.length > 0) lines.push(`_Next: ${open[0].title}_`, "");
	if (open.length > 0) {
		lines.push("## Open", "");
		for (const issue of open) lines.push(renderItem(issue, " "));
		lines.push("");
	}
	if (resolved.length > 0) {
		lines.push("## Resolved", "");
		for (const issue of resolved) lines.push(renderItem(issue, "x"));
		lines.push("");
	}
	return `${lines.join("\n")}`;
}

/**
 * Write the backlog atomically (temp file + rename) so a crash mid-write can never
 * leave a truncated backlog behind.
 */
export function writeIssuesFile(projectRoot: string, issues: readonly ParkedIssue[]): void {
	const dir = join(projectRoot, PARKED_DIR);
	mkdirSync(dir, { recursive: true });
	const target = join(dir, ISSUES_FILE);
	const temp = join(dir, `.${ISSUES_FILE}.${process.pid}.tmp`);
	writeFileSync(temp, renderChecklist(issues), "utf8");
	renameSync(temp, target);
}
