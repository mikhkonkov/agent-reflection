import type { ToolClassification } from "./event.js";
/** Default classification map for built-in Claude Code tools. */
export declare const DEFAULT_TOOL_CLASSIFICATIONS: Record<string, ToolClassification>;
/** Whether a tool call spawns a subagent. */
export declare function isDelegationTool(toolName: string | undefined): boolean;
/**
 * Classify a tool by name, using an optional per-config override map that is
 * merged over the defaults. Unknown built-in tools become "other". MCP tools
 * (name starting with `mcp__`) are classified as external_research when their
 * name contains a research hint, otherwise "other".
 */
export declare function classifyTool(toolName: string | undefined, overrides?: Record<string, ToolClassification>): ToolClassification | undefined;
