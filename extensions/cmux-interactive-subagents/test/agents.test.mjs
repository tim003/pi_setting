import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { discoverAgents, parseMarkdownAgent } from "../src/agents.ts";

test("discoverAgents reads global and project markdown agents with project override", () => {
  const root = mkdtempSync(join(tmpdir(), "cmux-agents-"));
  const cwd = join(root, "project");
  const agentDir = join(root, "home", ".pi", "agent");
  const globalAgents = join(agentDir, "agents");
  const projectAgents = join(cwd, ".pi", "agents");
  mkdirSync(globalAgents, { recursive: true });
  mkdirSync(projectAgents, { recursive: true });

  writeFileSync(
    join(globalAgents, "researcher.md"),
    `---\nname: researcher\ndescription: Global researcher\nmodel: anthropic/claude-haiku-4-5\nthinking: low\ntools: read, grep\nautoExit: true\n---\nGlobal body`,
  );
  writeFileSync(
    join(projectAgents, "researcher.md"),
    `---\nname: researcher\ndescription: Project researcher\nmodel: anthropic/claude-sonnet-4-6\ntools:\n  - read\n  - bash\n---\nProject body`,
  );
  writeFileSync(join(globalAgents, "reviewer.md"), `# Reviewer\nReview body`);

  const agents = discoverAgents(cwd, agentDir);
  assert.deepEqual(agents.map((a) => [a.name, a.source]), [
    ["researcher", "project"],
    ["reviewer", "global"],
  ]);

  const researcher = agents.find((a) => a.name === "researcher");
  assert.equal(researcher.description, "Project researcher");
  assert.equal(researcher.model, "anthropic/claude-sonnet-4-6");
  assert.deepEqual(researcher.tools, ["read", "bash"]);
  assert.equal(researcher.body, "Project body");

  const reviewer = agents.find((a) => a.name === "reviewer");
  assert.equal(reviewer.name, "reviewer");
  assert.equal(reviewer.body, "Review body");
});

test("discoverAgents excludes external CLI runners", () => {
  const root = mkdtempSync(join(tmpdir(), "cmux-external-cli-agents-"));
  const cwd = join(root, "project");
  const agentDir = join(root, "home", ".pi", "agent");
  const globalAgents = join(agentDir, "agents");
  mkdirSync(globalAgents, { recursive: true });

  writeFileSync(join(globalAgents, "delegate.md"), `---\nname: delegate\ndescription: Pi-backed delegate\ntools: read, bash\n---\nDelegate body`);
  writeFileSync(
    join(globalAgents, "codex-exec.md"),
    `---\nname: codex-exec\nrunner:\n  type: external-cli\n  command: codex\n---\nCodex body`,
  );

  const agents = discoverAgents(cwd, agentDir);
  assert.deepEqual(agents.map((a) => [a.name, a.source]), [["delegate", "global"]]);
});

test("parseMarkdownAgent keeps comma descriptions as strings and checks external runner only in frontmatter", () => {
  const descriptive = parseMarkdownAgent(
    `---\nname: docs\ndescription: Reviews code, docs, and tests\ntools: read, bash\n---\nMention type: external-cli in prose only.`,
    "/tmp/docs.md",
    "project",
  );
  assert.equal(descriptive.description, "Reviews code, docs, and tests");
  assert.equal(descriptive.externalCli, false);

  const external = parseMarkdownAgent(
    `---\nname: codex\nrunner:\n  type: external-cli\n  command: codex\n---\nBody`,
    "/tmp/codex.md",
    "global",
  );
  assert.equal(external.externalCli, true);
});
