import { test } from "node:test";
import assert from "node:assert/strict";

import { parseAvailableModels, checkModelSelection } from "../src/models.ts";

// A verbatim sample of `pi --list-models` output, including the header row.
const SAMPLE = `provider      model                       context  max-out  thinking  images
anthropic     claude-opus-5               1M       128K     yes       yes   
anthropic     claude-sonnet-4-6           1M       128K     yes       yes   
openai-codex  gpt-5.6-terra               272K     128K     yes       yes   
`;

const AVAILABLE = parseAvailableModels(SAMPLE);

test("parseAvailableModels reads provider and id pairs", () => {
  assert.deepEqual(parseAvailableModels(SAMPLE), [
    { provider: "anthropic", id: "claude-opus-5" },
    { provider: "anthropic", id: "claude-sonnet-4-6" },
    { provider: "openai-codex", id: "gpt-5.6-terra" },
  ]);
});

test("parseAvailableModels skips the header, blanks and stray warnings", () => {
  const noisy = `pi-claude-auth: Claude credentials are expired.\n${SAMPLE}\n`;
  const parsed = parseAvailableModels(noisy);
  assert.equal(parsed.length, 3);
  assert.ok(!parsed.some((m) => m.provider === "provider"));
  assert.ok(!parsed.some((m) => m.provider.startsWith("pi-claude-auth")));
});

test("parseAvailableModels returns empty for junk", () => {
  assert.deepEqual(parseAvailableModels(""), []);
  assert.deepEqual(parseAvailableModels("   \n\n"), []);
});

test("no model override is allowed: the child inherits the parent model", () => {
  assert.deepEqual(checkModelSelection(undefined, AVAILABLE), { ok: true });
  assert.deepEqual(checkModelSelection("   ", AVAILABLE), { ok: true });
});

test("an authenticated provider-qualified model is allowed", () => {
  assert.deepEqual(checkModelSelection("anthropic/claude-opus-5", AVAILABLE), { ok: true });
  assert.deepEqual(checkModelSelection("openai-codex/gpt-5.6-terra", AVAILABLE), { ok: true });
});

test("a trailing thinking suffix does not defeat the check", () => {
  assert.deepEqual(checkModelSelection("openai-codex/gpt-5.6-terra:high", AVAILABLE), { ok: true });
});

test("a bare model name is rejected before a tab is created", () => {
  const result = checkModelSelection("gpt-5.6-terra", AVAILABLE);
  assert.equal(result.ok, false);
  assert.match(result.error, /provider/i);
});

test("a bare name suggests the qualified form it almost certainly meant", () => {
  const result = checkModelSelection("gpt-5.6-terra", AVAILABLE);
  assert.equal(result.ok, false);
  assert.match(result.error, /openai-codex\/gpt-5\.6-terra/);
});

test("an unauthenticated provider is rejected and the real ones are named", () => {
  const result = checkModelSelection("openrouter/gpt-5.6-terra", AVAILABLE);
  assert.equal(result.ok, false);
  assert.match(result.error, /openrouter/);
  assert.match(result.error, /anthropic/);
  assert.match(result.error, /openai-codex/);
});

test("an unknown model id under a good provider is rejected", () => {
  const result = checkModelSelection("anthropic/claude-does-not-exist", AVAILABLE);
  assert.equal(result.ok, false);
  assert.match(result.error, /claude-does-not-exist/);
});

test("when the model list is unavailable the structural rule still holds", () => {
  const result = checkModelSelection("gpt-5.6-terra", undefined);
  assert.equal(result.ok, false);
  assert.match(result.error, /provider/i);
});

test("when the model list is unavailable a qualified model is let through", () => {
  assert.deepEqual(checkModelSelection("openrouter/some-model", undefined), { ok: true });
});

test("an empty model list is treated as unavailable, not as nothing allowed", () => {
  assert.deepEqual(checkModelSelection("anthropic/claude-opus-5", []), { ok: true });
});
