import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AgentOverride = { model?: string; thinking?: string };

export function settingsOverride(agentDir: string, agentName: string): AgentOverride {
  const settingsPath = join(agentDir, "settings.json");
  if (!existsSync(settingsPath)) return {};
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const override = settings?.subagents?.agentOverrides?.[agentName];
    return {
      model: typeof override?.model === "string" ? override.model : undefined,
      thinking: typeof override?.thinking === "string" ? override.thinking : undefined,
    };
  } catch {
    return {};
  }
}
