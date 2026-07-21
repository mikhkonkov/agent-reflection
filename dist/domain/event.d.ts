/**
 * Core event domain model. The `EventName` enum keeps the specification's eight
 * logical event names even though real Claude Code exposes a different set of
 * hooks. The collector maps real hooks onto these logical names:
 *
 *   SessionStart                         -> session_start
 *   UserPromptSubmit                     -> user_prompt
 *   PostToolUse (ok)                     -> post_tool_use
 *   PostToolUse (error/non-zero)         -> post_tool_use_failure
 *   PreToolUse where tool_name === Task  -> subagent_start (synthesized)
 *   SubagentStop                         -> subagent_stop
 *   PreCompact                           -> pre_compact
 *   SessionEnd                           -> session_end
 */
export type EventName = "session_start" | "user_prompt" | "post_tool_use" | "post_tool_use_failure" | "subagent_start" | "subagent_stop" | "pre_compact" | "session_end";
export type ErrorCategory = "test_failure" | "command_non_zero_exit" | "permission_denied" | "file_not_found" | "type_error" | "lint_error" | "timeout" | "network" | "unknown";
export type ToolClassification = "discovery" | "modification" | "execution" | "external_research" | "delegation" | "other";
export type CompactionTrigger = "manual" | "auto" | "unknown";
/**
 * A coarse, locally-derived classification of a user prompt. Determined by
 * keyword/shape heuristics only; never by an LLM. Stored so aggregate stats can
 * describe the shape of work without persisting prompt text.
 */
export type PromptClass = "discovery" | "implementation" | "debugging" | "architecture" | "research" | "unknown";
/**
 * The privacy-safe, normalized representation of a single lifecycle event.
 * This is the ONLY shape that is ever persisted. It never contains prompt text,
 * source code, raw tool input/output, terminal logs, secrets, or absolute paths.
 */
export interface NormalizedEvent {
    sessionId: string;
    /** Present only for events attributed to a subagent. */
    agentId?: string;
    agentType?: string;
    eventName: EventName;
    /** ISO-8601 timestamp. */
    occurredAt: string;
    toolName?: string;
    toolClassification?: ToolClassification;
    success?: boolean;
    durationMs?: number;
    inputSize?: number;
    outputSize?: number;
    relativePaths?: string[];
    pathCount?: number;
    errorCategory?: ErrorCategory;
    compactionTrigger?: CompactionTrigger;
    /** Approved, non-sensitive supplementary fields only. */
    metadata: Record<string, unknown>;
}
