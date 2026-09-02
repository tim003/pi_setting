import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { discoverAgents, type AgentDefinition } from "./src/agents.ts";
import { chooseMessageMode, resolveResumeSurface, validateLaunch, type ChildStatus } from "./src/core.ts";
import {
  childScriptPath,
  cmuxUnavailableText,
  createSurface,
  hasCmux,
  sendCommand,
  sendLongCommand,
  surfaceExists,
} from "./src/cmux.ts";
import { buildPiCommand, normalizeMessageForTui, scriptWithExitTrap } from "./src/launch.ts";
import { makeChildSessionPath, readFinalAssistantMessage, readLoadout, writeLoadout, type ChildLoadout } from "./src/session.ts";
import { settingsOverride } from "./src/settings.ts";

type ChildRecord = {
  name: string;
  agent: string;
  task: string;
  status: ChildStatus;
  surface: string;
  sessionFile: string;
  cwd: string;
  model?: string;
  startedAt: number;
  lastResult?: string;
  lastQuestion?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function agentDir(): string {
  return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

function sessionsDir(): string {
  return join(agentDir(), "sessions", "cmux-interactive-subagents");
}

function artifactDir(): string {
  return join(agentDir(), "artifacts", "cmux-interactive-subagents");
}

function toolResult(text: string, details: Record<string, unknown> = {}, isError = false) {
  return { content: [{ type: "text" as const, text }], details, isError };
}

function writePromptFile(name: string, body: string): string {
  const path = join(artifactDir(), "system-prompts", `${name}.md`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf8");
  return path;
}

function childCommand(loadout: ChildLoadout, sessionFile: string, message: string): string {
  return buildPiCommand({
    childHelperPath: join(__dirname, "child-helper.ts"),
    sessionFile,
    message,
    loadout,
    piCodingAgentDir: process.env.PI_CODING_AGENT_DIR,
  });
}

function sendLaunchCommand(surface: string, loadout: ChildLoadout, sessionFile: string, message: string, scriptName: string): void {
  const scriptPath = childScriptPath(__dirname, scriptName);
  sendLongCommand(surface, scriptWithExitTrap(childCommand(loadout, sessionFile, message), sessionFile), scriptPath);
}

function fullTask(agent: AgentDefinition, task: string): string {
  return [
    "Complete your task autonomously. When you are finished, simply stop; your session ends automatically.",
    "If you need clarification from the parent/orchestrator, use ask_question and wait.",
    task,
    "Your final assistant message should summarize what you accomplished.",
  ].join("\n\n");
}

export default function (pi: ExtensionAPI) {
  const children = new Map<string, ChildRecord>();
  let watcher: NodeJS.Timeout | null = null;

  function listAgents(ctx: any): AgentDefinition[] {
    return discoverAgents(ctx.cwd, agentDir());
  }

  function deliverToParent(message: string) {
    try {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
    } catch {
      try {
        pi.sendUserMessage(message);
      } catch {
        // Best effort. The next explicit tool call/list still shows state.
      }
    }
  }

  function pollChildren() {
    for (const child of children.values()) {
      const askPath = `${child.sessionFile}.ask`;
      if (existsSync(askPath)) {
        try {
          const ask = JSON.parse(readFileSync(askPath, "utf8"));
          child.status = "waiting";
          child.lastQuestion = String(ask.question ?? "");
          rmSync(askPath, { force: true });
          deliverToParent(`Subagent ${child.name} asks: ${child.lastQuestion}\n\nReply with subagent_message({"name":"${child.name}","message":"..."}).`);
        } catch {
          // Leave unreadable ask files for inspection.
        }
      }

      const exitPath = `${child.sessionFile}.exit`;
      if (existsSync(exitPath)) {
        try {
          const exit = JSON.parse(readFileSync(exitPath, "utf8"));
          child.status = exit.type === "error" ? "failed" : "finished";
          child.lastResult = readFinalAssistantMessage(child.sessionFile);
          rmSync(exitPath, { force: true });
          const prefix = child.status === "failed" ? `Subagent ${child.name} failed` : `Subagent ${child.name} finished`;
          const error = exit.errorMessage ? `\n\nError: ${exit.errorMessage}` : "";
          deliverToParent(`${prefix}.\n\n${child.lastResult || "(no final assistant message)"}${error}`);
        } catch {
          // Leave unreadable exit files for inspection.
        }
      }
    }
  }

  pi.on("session_start", () => {
    if (!watcher) watcher = setInterval(pollChildren, 1000);
  });

  pi.on("session_shutdown", () => {
    if (watcher) clearInterval(watcher);
    watcher = null;
  });

  pi.registerTool({
    name: "subagents_list",
    label: "List Subagents",
    description: "List available agent definitions and known cmux interactive child sessions.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const agents = listAgents(ctx);
      const agentLines = agents.length
        ? agents.map((a) => `• ${a.name} (${a.source})${a.description ? ` — ${a.description}` : ""}`).join("\n")
        : "No agent definitions found.";
      const childList = Array.from(children.values());
      const childLines = childList.length
        ? childList.map((c) => `• ${c.name}: ${c.status} (${c.agent}) ${c.sessionFile}`).join("\n")
        : "No known child sessions.";
      return toolResult(`Agents:\n${agentLines}\n\nKnown children:\n${childLines}`, { agents, children: childList });
    },
  });

  pi.registerTool({
    name: "subagent",
    label: "Start cmux Subagent",
    description:
      "Start a named cmux interactive Pi-backed subagent. Required: name, agent, task. " +
      "Names are chosen by the parent/orchestrator and must be unique; use subagent_message for follow-up/resume.",
    parameters: Type.Object({
      name: Type.String({ description: "Required unique stable subagent name, e.g. docs-auditor." }),
      agent: Type.String({ description: "Agent definition name." }),
      task: Type.String({ description: "Task for the child agent." }),
      model: Type.Optional(Type.String({ description: "Optional Pi model override." })),
      cwd: Type.Optional(Type.String({ description: "Optional child working directory." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!hasCmux()) return toolResult(cmuxUnavailableText(), { available: false }, true);

      const validation = validateLaunch(params, new Set(children.keys()));
      if (!validation.ok) return toolResult(validation.error, { error: validation.error }, true);

      const agents = listAgents(ctx);
      const agent = agents.find((a) => a.name === validation.agent);
      if (!agent) {
        const available = agents.map((a) => a.name).join(", ") || "none";
        return toolResult(`Unknown agent: ${validation.agent}. Available agents: ${available}`, { agents }, true);
      }

      const cwd = validation.cwd ?? ctx.cwd;
      const sessionFile = makeChildSessionPath(sessionsDir(), validation.name);
      if (agent.body) writePromptFile(validation.name, agent.body);
      const override = settingsOverride(agentDir(), validation.agent);
      const loadout: ChildLoadout = {
        name: validation.name,
        agent: validation.agent,
        cwd,
        model: validation.model ?? agent.model ?? override.model,
        thinking: agent.thinking ?? override.thinking,
        tools: agent.tools,
        systemPrompt: agent.body,
        autoExit: agent.autoExit,
      };
      writeLoadout(sessionFile, loadout);

      const surface = createSurface(validation.name);
      sendLaunchCommand(surface, loadout, sessionFile, fullTask(agent, validation.task), validation.name);

      const child: ChildRecord = {
        name: validation.name,
        agent: validation.agent,
        task: validation.task,
        status: "running",
        surface,
        sessionFile,
        cwd,
        model: loadout.model,
        startedAt: Date.now(),
      };
      children.set(validation.name, child);
      return toolResult(`Started subagent ${validation.name} (${validation.agent}) in ${surface}.`, child);
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", "subagent ") + theme.fg("accent", String(args.name ?? "")) + theme.fg("dim", ` (${args.agent ?? ""})`),
        0,
        0,
      );
    },
  });

  pi.registerTool({
    name: "subagent_message",
    label: "Message cmux Subagent",
    description:
      "Send a message to a named child. Running/waiting children are steered live; finished/failed children resume the same session.",
    parameters: Type.Object({
      name: Type.String({ description: "Exact child name." }),
      message: Type.String({ description: "Message to send or resume with." }),
    }),
    async execute(_toolCallId, params) {
      if (!hasCmux()) return toolResult(cmuxUnavailableText(), { available: false }, true);
      const name = String(params.name ?? "").trim();
      const message = String(params.message ?? "").trim();
      if (!name || !message) return toolResult("subagent_message requires name and message.", {}, true);
      const child = children.get(name);
      if (!child) return toolResult(`Unknown subagent name: ${name}`, { error: `Unknown subagent name: ${name}` }, true);
      pollChildren();
      const mode = chooseMessageMode(name, children);
      if (!mode.ok) return toolResult(mode.error, { error: mode.error }, true);

      if (mode.mode === "steer") {
        child.status = "running";
        sendCommand(child.surface, normalizeMessageForTui(message));
        return toolResult(`Message delivered to running subagent ${name}.`, { name, status: "steered" });
      }

      child.status = "running";
      const loadout = readLoadout(child.sessionFile) ?? {
        name: child.name,
        agent: child.agent,
        cwd: child.cwd,
        model: child.model,
        autoExit: true,
      };
      const resumeSurface = resolveResumeSurface({
        name: child.name,
        surface: child.surface,
        surfaceExists,
        createSurface,
      });
      child.surface = resumeSurface.surface;
      sendLaunchCommand(child.surface, loadout, child.sessionFile, message, `${child.name}-resume`);
      const surfaceNote = resumeSurface.recreated ? ` Opened a new cmux surface ${child.surface}.` : "";
      return toolResult(`Resumed subagent ${name}.${surfaceNote} Result will be delivered when it finishes.`, {
        name,
        status: "resumed",
        surface: child.surface,
        recreatedSurface: resumeSurface.recreated,
      });
    },
    renderCall(args, theme) {
      return new Text(theme.fg("toolTitle", "subagent_message ") + theme.fg("accent", String(args.name ?? "")), 0, 0);
    },
  });
}
