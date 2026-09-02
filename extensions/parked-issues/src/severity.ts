/**
 * Severity assignment for parked issues.
 *
 * The agent proposes a severity when it calls `park_issue`. This module applies a
 * hard floor on top of that judgment: a small, deliberately short list of phrases
 * that force `high` no matter what the model decided. High severity is what makes
 * an item interrupt immediately instead of waiting for end-of-turn triage.
 *
 * The list is intentionally phrase-based rather than word-based. A bare "token"
 * rule would fire on `tokenCount`/`tokenTarget`, which appear constantly in normal
 * discussion; an escalation list that cries wolf is one the user turns off.
 */

export type Severity = "high" | "medium" | "low";

/** Lowercase substrings that force `high`. Keep this list short and specific. */
export const ESCALATION_PATTERNS: readonly string[] = [
	"credential",
	"secret",
	"api key",
	"private key",
	"ssh key",
	"auth.json",
	".env",
	"access token",
	"api token",
	"auth token",
	"--force",
	"force push",
	"reset --hard",
	"rm -rf",
	"drop table",
];

/**
 * Resolve the effective severity for an issue. Never downgrades: a caller that
 * already decided `high` stays `high`.
 */
export function escalate(text: string, proposed: Severity): Severity {
	if (proposed === "high") return "high";
	const haystack = text.toLowerCase();
	for (const pattern of ESCALATION_PATTERNS) {
		if (haystack.includes(pattern)) return "high";
	}
	return proposed;
}
