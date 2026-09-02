import { strict as assert } from "node:assert";
import { test } from "node:test";

import { escalate } from "../src/severity.ts";

test("escalates a credential mention to high regardless of proposed severity", () => {
	assert.equal(escalate("Committed credentials.ts to the repo", "low"), "high");
});

test("escalates destructive git history rewrites to high", () => {
	assert.equal(escalate("we could clean this up with reset --hard", "medium"), "high");
});

test("leaves ordinary suggestions at their proposed severity", () => {
	assert.equal(escalate("rename a variable for clarity", "low"), "low");
});

test("does not escalate on 'token' appearing inside an unrelated word", () => {
	// This codebase talks about tokenCount/tokenTarget constantly; a bare
	// "token" substring rule would escalate nearly every memory discussion.
	assert.equal(escalate("poolTokens exceeds the tokenTarget", "low"), "low");
});

test("never downgrades a severity the caller already set to high", () => {
	assert.equal(escalate("rename a variable for clarity", "high"), "high");
});
