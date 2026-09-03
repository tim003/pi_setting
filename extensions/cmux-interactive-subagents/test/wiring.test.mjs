import { test } from "node:test";
import assert from "node:assert/strict";
import createExtension from "../index.ts";

function fakePi() {
  const tools = [];
  const commands = new Map();
  return {
    tools,
    commands,
    api: {
      registerTool: (t) => tools.push(t.name),
      registerCommand: (name, spec) => commands.set(name, spec),
      on: () => {},
      sendUserMessage: () => {},
    },
  };
}

test("the extension registers its tools and the fleet command", () => {
  const pi = fakePi();
  createExtension(pi.api);
  assert.deepEqual(pi.tools.sort(), ["subagent", "subagent_message", "subagents_list"]);
  assert.ok(pi.commands.has("fleet"), "children are invisible, so /fleet is the only way to reach one");
  assert.match(pi.commands.get("fleet").description, /show|steer|close/i);
});

// Without cmux there are no tabs to rotate, and the command must say so
// rather than throwing at the user.
test("/fleet explains itself when cmux is unreachable", async () => {
  const previous = process.env.CMUX_SOCKET_PATH;
  delete process.env.CMUX_SOCKET_PATH;
  try {
    const pi = fakePi();
    createExtension(pi.api);
    const out = await pi.commands.get("fleet").handler("", { hasUI: false, cwd: process.cwd() });
    assert.match(String(out), /cmux is not available/i);
  } finally {
    if (previous !== undefined) process.env.CMUX_SOCKET_PATH = previous;
  }
});
