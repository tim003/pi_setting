import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import createExtension from "../index.ts";

function fakePi() {
  const tools = [];
  const toolSpecs = new Map();
  const commands = new Map();
  return {
    tools,
    toolSpecs,
    commands,
    api: {
      registerTool: (t) => {
        tools.push(t.name);
        toolSpecs.set(t.name, t);
      },
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

function cmuxUsable() {
  try {
    execFileSync("sh", ["-lc", "command -v cmux"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function textOf(result) {
  return (result?.content ?? []).map((part) => part.text ?? "").join("\n");
}

// A bare model name is what actually wedged two robotics tabs: it resolved to a
// provider with no key, the child died before its first turn, and nothing ever
// wrote the exit sidecar the parent waits for.
test("a bare model name is refused before any tab is created", async (t) => {
  if (!cmuxUsable()) return t.skip("cmux not installed; the spawn path is unreachable here");
  const previous = process.env.CMUX_SOCKET_PATH;
  process.env.CMUX_SOCKET_PATH = previous ?? "/tmp/does-not-need-to-connect.sock";
  const name = `guardprobe-${process.pid}`;
  try {
    const pi = fakePi();
    createExtension(pi.api);
    const result = await pi.toolSpecs
      .get("subagent")
      .execute("call-1", { name, agent: "delegate", task: "noop", model: "gpt-5.6-terra" }, undefined, undefined, {
        cwd: process.cwd(),
      });

    assert.equal(result.isError, true);
    assert.match(textOf(result), /provider-qualified/i);
    const launchScript = join(homedir(), ".pi/agent/extensions/cmux-interactive-subagents/.generated", `${name}.launch.sh`);
    assert.ok(!existsSync(launchScript), "a refused launch must not leave a launch script behind");
  } finally {
    if (previous === undefined) delete process.env.CMUX_SOCKET_PATH;
    else process.env.CMUX_SOCKET_PATH = previous;
  }
});
