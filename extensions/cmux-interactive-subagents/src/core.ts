export type LaunchInput = {
  name?: unknown;
  agent?: unknown;
  task?: unknown;
  model?: unknown;
  cwd?: unknown;
};

export type LaunchValidation =
  | { ok: true; name: string; agent: string; task: string; model?: string; cwd?: string }
  | { ok: false; error: string };

export type ChildStatus = "running" | "finished" | "waiting" | "failed";

export type ChildRecordLike = {
  status: ChildStatus;
};

export type MessageMode =
  | { ok: true; mode: "steer" | "resume" }
  | { ok: false; error: string };

export type AutoExitState = {
  autoExit: boolean;
  awaitingAnswer: boolean;
  runningChildren: number;
};

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function requiredString(value: unknown, field: string): string | { error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `subagent.${field} is required` };
  }
  return value.trim();
}

export function sanitizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("subagent.name is required");
  if (!SAFE_NAME.test(trimmed)) {
    throw new Error("subagent.name must be safe: start with a letter or number and use only letters, numbers, dot, underscore, or hyphen");
  }
  return trimmed;
}

export function validateLaunch(input: LaunchInput, knownNames: Set<string>): LaunchValidation {
  const rawName = requiredString(input.name, "name");
  if (typeof rawName !== "string") return { ok: false, error: rawName.error };

  let name: string;
  try {
    name = sanitizeName(rawName);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (knownNames.has(name)) {
    return { ok: false, error: `Subagent name already exists: ${name}. Use subagent_message to contact it.` };
  }

  const agent = requiredString(input.agent, "agent");
  if (typeof agent !== "string") return { ok: false, error: agent.error };

  const task = requiredString(input.task, "task");
  if (typeof task !== "string") return { ok: false, error: task.error };

  const result: Extract<LaunchValidation, { ok: true }> = { ok: true, name, agent, task };
  if (typeof input.model === "string" && input.model.trim()) result.model = input.model.trim();
  if (typeof input.cwd === "string" && input.cwd.trim()) result.cwd = input.cwd.trim();
  return result;
}

export function chooseMessageMode(name: string, registry: Map<string, ChildRecordLike>): MessageMode {
  const record = registry.get(name);
  if (!record) return { ok: false, error: `Unknown subagent name: ${name}` };
  if (record.status === "running" || record.status === "waiting") return { ok: true, mode: "steer" };
  return { ok: true, mode: "resume" };
}

export function shouldAutoExitOnAgentEnd(state: AutoExitState, messages: any[] | undefined): boolean {
  if (!state.autoExit || state.awaitingAnswer || state.runningChildren > 0) return false;
  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "assistant") return msg.stopReason !== "aborted";
    }
  }
  return true;
}
