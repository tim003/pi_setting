import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { writeFileSync } from "node:fs";
import { shouldAutoExitOnAgentEnd } from "./src/core.ts";

function runningChildrenCount(): number {
  const fn = (globalThis as any)[Symbol.for("cmux-interactive-subagents/running-children-count")];
  if (typeof fn !== "function") return 0;
  try {
    const value = fn();
    return typeof value === "number" && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function finalAssistantError(messages: any[] | undefined): { errorMessage: string; stopReason: "error" } | null {
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    if (msg.stopReason !== "error") return null;
    return {
      errorMessage: typeof msg.errorMessage === "string" && msg.errorMessage.trim()
        ? msg.errorMessage.trim()
        : "Child agent ended with stopReason=error.",
      stopReason: "error",
    };
  }
  return null;
}

export default function (pi: ExtensionAPI) {
  const childName = process.env.CMUX_SUBAGENT_NAME ?? "subagent";
  const childAgent = process.env.CMUX_SUBAGENT_AGENT ?? "";
  const sessionFile = process.env.CMUX_SUBAGENT_SESSION ?? process.env.PI_SUBAGENT_SESSION;
  const autoExit = process.env.CMUX_SUBAGENT_AUTO_EXIT === "1";
  let awaitingAnswer = false;
  let agentStarted = false;
  let lastMessages: any[] | undefined;

  function renderWidget(ctx: any) {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(
      "cmux-subagent-status",
      (_tui: any, theme: any) =>
        new Text(
          theme.fg("accent", `[${childAgent || childName}]`) +
            theme.fg("dim", ` ${autoExit ? "auto-exit" : "interactive"}`) +
            (awaitingAnswer ? theme.fg("warning", " · waiting for parent") : ""),
          0,
          0,
        ),
      { placement: "aboveEditor" },
    );
  }

  pi.on("session_start", (_event, ctx) => renderWidget(ctx));
  pi.on("input", (_event, ctx) => {
    awaitingAnswer = false;
    renderWidget(ctx);
  });
  pi.on("agent_start", (_event, ctx) => {
    agentStarted = true;
    awaitingAnswer = false;
    renderWidget(ctx);
  });

  pi.on("agent_end", (event, ctx) => {
    lastMessages = (event as any).messages as any[] | undefined;
    renderWidget(ctx);
  });

  pi.on("agent_settled", (_event, ctx) => {
    const messages = lastMessages;
    const shouldExit = shouldAutoExitOnAgentEnd(
      { autoExit, awaitingAnswer, runningChildren: runningChildrenCount() },
      messages,
    );

    if (!shouldExit) {
      renderWidget(ctx);
      return;
    }

    if (sessionFile) {
      const error = finalAssistantError(messages);
      if (error) {
        writeFileSync(`${sessionFile}.exit`, JSON.stringify({ type: "error", ...error }));
      } else {
        writeFileSync(`${sessionFile}.exit`, JSON.stringify({ type: "done" }));
      }
    }
    ctx.shutdown();
  });

  pi.registerTool({
    name: "ask_question",
    label: "Ask Parent",
    description:
      "Ask the parent/orchestrator one clarifying question and wait for its answer. " +
      "Use this instead of guessing when requirements are ambiguous or blocked.",
    parameters: Type.Object({
      question: Type.String({ description: "One question for the parent/orchestrator." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!sessionFile) throw new Error("ask_question requires CMUX_SUBAGENT_SESSION or PI_SUBAGENT_SESSION.");
      awaitingAnswer = true;
      writeFileSync(
        `${sessionFile}.ask`,
        JSON.stringify({ name: childName, agent: childAgent, question: params.question }),
      );
      renderWidget(ctx);
      return {
        content: [{ type: "text", text: "Question sent to parent. Stop and wait for the answer." }],
        details: { question: params.question },
      };
    },
    renderCall(args, theme) {
      return new Text(theme.fg("toolTitle", "ask_question ") + theme.fg("muted", String(args.question ?? "")), 0, 0);
    },
  });
}
