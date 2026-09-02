import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

export type AgentSource = "global" | "project";

export type AgentDefinition = {
  name: string;
  source: AgentSource;
  path: string;
  description?: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  autoExit: boolean;
  externalCli: boolean;
  body: string;
};

type ParsedMarkdown = {
  attrs: Record<string, unknown>;
  body: string;
};

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterScalar(key: string, value: string): unknown {
  if (key === "tools") return value.split(",").map((part) => part.trim()).filter(Boolean);
  return parseScalar(value);
}

export function parseMarkdownAgent(markdown: string, filePath: string, source: AgentSource): AgentDefinition {
  let attrs: Record<string, unknown> = {};
  let body = markdown.trim();
  let frontmatterText = "";

  if (markdown.startsWith("---\n")) {
    const end = markdown.indexOf("\n---", 4);
    if (end >= 0) {
      frontmatterText = markdown.slice(4, end);
      const frontmatter = frontmatterText.split(/\r?\n/);
      body = markdown.slice(end + 4).trim();
      let currentListKey: string | null = null;
      for (const rawLine of frontmatter) {
        const line = rawLine.trimEnd();
        if (!line.trim()) continue;
        const listMatch = line.match(/^\s*-\s+(.+)$/);
        if (listMatch && currentListKey) {
          const existing = Array.isArray(attrs[currentListKey]) ? attrs[currentListKey] as unknown[] : [];
          existing.push(parseScalar(listMatch[1]));
          attrs[currentListKey] = existing;
          continue;
        }
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!match) continue;
        const [, key, value] = match;
        if (value === "") {
          attrs[key] = [];
          currentListKey = key;
        } else {
          attrs[key] = parseFrontmatterScalar(key, value);
          currentListKey = null;
        }
      }
    }
  } else {
    body = markdown.replace(/^#\s+[^\n]+\n?/, "").trim();
  }

  const inferredName = basename(filePath, extname(filePath));
  const name = typeof attrs.name === "string" && attrs.name.trim() ? attrs.name.trim() : inferredName;
  const toolsRaw = attrs.tools;
  const tools = Array.isArray(toolsRaw)
    ? toolsRaw.map(String).map((v) => v.trim()).filter(Boolean)
    : typeof toolsRaw === "string"
      ? toolsRaw.split(",").map((v) => v.trim()).filter(Boolean)
      : undefined;

  return {
    name,
    source,
    path: filePath,
    description: typeof attrs.description === "string" ? attrs.description : undefined,
    model: typeof attrs.model === "string" ? attrs.model : undefined,
    thinking: typeof attrs.thinking === "string" ? attrs.thinking : undefined,
    tools,
    autoExit: typeof attrs.autoExit === "boolean" ? attrs.autoExit : true,
    externalCli: frontmatterText.includes("type: external-cli") || frontmatterText.includes("adapter: codex-exec") || frontmatterText.includes("adapter: claude-code"),
    body,
  };
}

function readAgentsFromDir(dir: string, source: AgentSource): AgentDefinition[] {
  if (!existsSync(dir)) return [];
  const agents: AgentDefinition[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const filePath = join(dir, entry);
    if (!statSync(filePath).isFile() || !entry.endsWith(".md")) continue;
    const agent = parseMarkdownAgent(readFileSync(filePath, "utf8"), filePath, source);
    if (!agent.externalCli) agents.push(agent);
  }
  return agents;
}

export function discoverAgents(cwd: string, agentDir: string): AgentDefinition[] {
  const byName = new Map<string, AgentDefinition>();
  for (const agent of readAgentsFromDir(join(agentDir, "agents"), "global")) byName.set(agent.name, agent);
  for (const agent of readAgentsFromDir(join(cwd, ".pi", "agents"), "project")) byName.set(agent.name, agent);
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
