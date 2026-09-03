import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Drive the extension the way Pi does: activate it, capture the tool_call handler,
 * then hand it a bash event. Asserting on block/allow and on whether a popup was
 * raised is the only way to see the trust wiring, which unit tests cannot reach.
 */
async function activateGuard({ cwd, agentDir, hasUI = true, promptChoice = "abort" }) {
	process.env.PI_CODING_AGENT_DIR = agentDir;
	const { default: activate } = await import(`../index.ts?t=${Math.random()}`);

	const handlers = new Map();
	const commands = new Map();
	const flags = new Map();
	let promptsRaised = 0;
	let lastItems = [];

	const pi = {
		on: (event, handler) => handlers.set(event, handler),
		registerCommand: (name, spec) => commands.set(name, spec),
		registerFlag: (name, spec) => flags.set(`--${name}`, spec.default),
		getFlag: (name) => flags.get(name),
	};
	activate(pi);

	const theme = {
		fg: (_c, t) => t,
		bg: (_c, t) => t,
		bold: (t) => t,
	};
	const ctx = {
		hasUI,
		sessionManager: { getCwd: () => cwd },
		ui: {
			theme,
			setStatus: () => {},
			notify: () => {},
			custom: async (render) => {
				promptsRaised++;
				// Capture the offered choices without running the real TUI.
				render(
					{ requestRender: () => {} },
					theme,
					{},
					() => {},
				);
				return promptChoice;
			},
		},
	};

	// SelectList construction inside the renderer records the items it was given.
	const bash = async (command) =>
		handlers.get("tool_call")(
			{ toolName: "bash", name: "bash", input: { command } },
			ctx,
		);

	return {
		bash,
		command: (name) => commands.get(name),
		ctx,
		promptCount: () => promptsRaised,
		items: () => lastItems,
	};
}

function scratch() {
	return realpathSync(mkdtempSync(join(tmpdir(), "bash-guard-wiring-")));
}

test("a high-risk command inside a trusted project runs without a prompt", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(join(project, "build"), { recursive: true });

	const guard = await activateGuard({ cwd: project, agentDir: join(dir, "agent") });
	await guard.command("bash-guard").handler("trust", guard.ctx);

	const result = await guard.bash("rm -rf build");
	assert.equal(result, undefined, "expected the command to be allowed");
	assert.equal(guard.promptCount(), 0, "expected no popup for a trusted project");

	rmSync(dir, { recursive: true, force: true });
});

test("the same command reaching outside the trusted project still prompts", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(project, { recursive: true });

	const guard = await activateGuard({ cwd: project, agentDir: join(dir, "agent") });
	await guard.command("bash-guard").handler("trust", guard.ctx);

	const result = await guard.bash("rm -rf /etc/hosts");
	assert.equal(guard.promptCount(), 1, "expected a popup for a path outside the project");
	assert.ok(result?.block, "expected abort to block the command");

	rmSync(dir, { recursive: true, force: true });
});

test("a subagent with no UI is released by a project grant", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(join(project, "build"), { recursive: true });

	const granting = await activateGuard({ cwd: project, agentDir: join(dir, "agent") });
	await granting.command("bash-guard").handler("trust", granting.ctx);

	const child = await activateGuard({ cwd: project, agentDir: join(dir, "agent"), hasUI: false });
	const result = await child.bash("rm -rf build");
	assert.equal(result, undefined, "expected the grant to release a headless command");
	assert.equal(child.promptCount(), 0);

	rmSync(dir, { recursive: true, force: true });
});

test("a subagent with no UI is still blocked outside the grant", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(project, { recursive: true });

	const granting = await activateGuard({ cwd: project, agentDir: join(dir, "agent") });
	await granting.command("bash-guard").handler("trust", granting.ctx);

	const child = await activateGuard({ cwd: project, agentDir: join(dir, "agent"), hasUI: false });
	const result = await child.bash("rm -rf /etc/hosts");
	assert.ok(result?.block, "expected a headless command outside the project to be blocked");

	rmSync(dir, { recursive: true, force: true });
});

test("choosing trust at the prompt grants the project and runs the command", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(join(project, "build"), { recursive: true });
	const agentDir = join(dir, "agent");

	const guard = await activateGuard({ cwd: project, agentDir, promptChoice: "trust" });
	const first = await guard.bash("rm -rf build");
	assert.equal(first, undefined, "expected the command to run after trusting");
	assert.equal(guard.promptCount(), 1);

	// The grant must persist, so a second identical command asks nothing.
	const second = await guard.bash("rm -rf build");
	assert.equal(second, undefined);
	assert.equal(guard.promptCount(), 1, "expected the grant to silence the second command");

	rmSync(dir, { recursive: true, force: true });
});

test("an untrusted project prompts exactly as before", async () => {
	const dir = scratch();
	const project = join(dir, "project");
	mkdirSync(join(project, "build"), { recursive: true });

	const guard = await activateGuard({ cwd: project, agentDir: join(dir, "agent") });
	const result = await guard.bash("rm -rf build");
	assert.equal(guard.promptCount(), 1, "expected a popup with no grant in place");
	assert.ok(result?.block);

	rmSync(dir, { recursive: true, force: true });
});
