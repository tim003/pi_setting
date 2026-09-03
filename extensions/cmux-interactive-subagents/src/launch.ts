import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { shellEscape } from "./cmux.ts";
import type { ChildLoadout } from "./session.ts";

export type BuildPiCommandOptions = {
  childHelperPath: string;
  sessionFile: string;
  message: string;
  loadout: ChildLoadout;
  piCodingAgentDir?: string;
};

export function normalizeMessageForTui(message: string): string {
  return message.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\\n");
}

function extensionPathIfInstalled(agentDir: string, packageName: string): string | undefined {
  const path = join(agentDir, "npm", "node_modules", packageName, "src", "index.ts");
  return existsSync(path) ? path : undefined;
}

/** Locally installed extensions live outside npm/, so they resolve differently. */
function localExtensionIfInstalled(agentDir: string, name: string): string | undefined {
  const path = join(agentDir, "extensions", name, "index.ts");
  return existsSync(path) ? path : undefined;
}

export function buildPiCommand(options: BuildPiCommandOptions): string {
  const { childHelperPath, sessionFile, message, loadout, piCodingAgentDir } = options;
  const resolvedAgentDir = piCodingAgentDir || join(homedir(), ".pi", "agent");
  // --no-extensions means a child gets only what is named here. bash-guard has to be
  // among them: a child has no UI to approve anything in, so without it the least
  // supervised sessions on the machine were also the only unguarded ones.
  //
  // It is loaded as an ordinary extension, deliberately not flagged via
  // PI_SUBAGENT_DEPTH. That flag selects a mode which hard-blocks recursive deletes
  // outright, and no project grant can release it — children could then never do the
  // routine work a trusted project exists to permit. On the ordinary path a child
  // proceeds inside a granted project and blocks everywhere else, for want of a UI.
  const extensionArgs = [
    extensionPathIfInstalled(resolvedAgentDir, "pi-claude-auth"),
    localExtensionIfInstalled(resolvedAgentDir, "bash-guard"),
    childHelperPath,
  ].filter((path): path is string => Boolean(path));
  const parts = ["pi", "--session", shellEscape(sessionFile), "--no-extensions"];
  for (const extensionPath of extensionArgs) {
    parts.push("-e", shellEscape(extensionPath));
  }

  if (loadout.model) {
    const model = loadout.thinking ? `${loadout.model}:${loadout.thinking}` : loadout.model;
    parts.push("--model", shellEscape(model));
  } else if (loadout.thinking) {
    parts.push("--thinking", shellEscape(loadout.thinking));
  }

  if (loadout.tools && loadout.tools.length > 0) {
    const tools = Array.from(new Set([...loadout.tools.filter((tool) => tool !== "contact_supervisor"), "ask_question"]));
    parts.push("--tools", shellEscape(tools.join(",")));
  }

  if (loadout.systemPrompt) {
    parts.push("--append-system-prompt", shellEscape(loadout.systemPrompt));
  }

  parts.push("--", shellEscape(message));

  const env = [
    `CMUX_SUBAGENT_NAME=${shellEscape(loadout.name)}`,
    `CMUX_SUBAGENT_AGENT=${shellEscape(loadout.agent)}`,
    `CMUX_SUBAGENT_SESSION=${shellEscape(sessionFile)}`,
    loadout.autoExit === false ? "" : "CMUX_SUBAGENT_AUTO_EXIT=1",
    piCodingAgentDir ? `PI_CODING_AGENT_DIR=${shellEscape(piCodingAgentDir)}` : "",
  ].filter(Boolean);

  const cd = loadout.cwd ? `cd ${shellEscape(loadout.cwd)} && ` : "";
  return `${cd}${env.join(" ")} ${parts.join(" ")}`;
}

export function scriptWithExitTrap(command: string, sessionFile: string): string {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    `EXIT_PATH=${shellEscape(`${sessionFile}.exit`)}`,
    `trap 'status=$?; if [ $status -ne 0 ] && [ ! -f "$EXIT_PATH" ]; then printf "{\\\"type\\\":\\\"error\\\",\\\"errorMessage\\\":\\\"child launch or process failed with exit status %s\\\",\\\"stopReason\\\":\\\"error\\\"}" "$status" > "$EXIT_PATH"; fi' EXIT`,
    command,
    "trap - EXIT",
  ].join("\n") + "\n";
}
