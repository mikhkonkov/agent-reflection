import type { ToolClassification } from "./event.js";

/** Default classification map for built-in Claude Code tools. */
export const DEFAULT_TOOL_CLASSIFICATIONS: Record<string, ToolClassification> = {
  Glob: "discovery",
  Grep: "discovery",
  Read: "discovery",
  Edit: "modification",
  Write: "modification",
  MultiEdit: "modification",
  NotebookEdit: "modification",
  Bash: "execution",
  Task: "delegation",
  Agent: "delegation",
};

/**
 * Tool names that spawn a subagent. Claude Code has shipped this tool under
 * more than one name (`Task`, later `Agent`); matching a single literal name
 * silently drops every subagent_start, so accept both.
 */
const DELEGATION_TOOL_NAMES = new Set(["Task", "Agent"]);

/** Whether a tool call spawns a subagent. */
export function isDelegationTool(toolName: string | undefined): boolean {
  return toolName !== undefined && DELEGATION_TOOL_NAMES.has(toolName);
}

/** Substrings that mark an MCP tool as external research. */
const EXTERNAL_RESEARCH_HINTS = ["search", "fetch", "browse", "docs", "research"];

const MCP_PREFIX = "mcp__";

/**
 * Classify a tool by name, using an optional per-config override map that is
 * merged over the defaults. Unknown built-in tools become "other". MCP tools
 * (name starting with `mcp__`) are classified as external_research when their
 * name contains a research hint, otherwise "other".
 */
export function classifyTool(
  toolName: string | undefined,
  overrides: Record<string, ToolClassification> = {},
): ToolClassification | undefined {
  if (!toolName) return undefined;

  const map = { ...DEFAULT_TOOL_CLASSIFICATIONS, ...overrides };
  const explicit = map[toolName];
  if (explicit) return explicit;

  if (toolName.startsWith(MCP_PREFIX)) {
    const lower = toolName.toLowerCase();
    if (EXTERNAL_RESEARCH_HINTS.some((hint) => lower.includes(hint))) {
      return "external_research";
    }
    return "other";
  }

  return "other";
}
