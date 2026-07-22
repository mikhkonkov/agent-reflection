/**
 * Prefix for a subagent row created from a `Task` PreToolUse, before Claude
 * Code's own agent id is known. Claude Code only reveals `agent_id` on events
 * *inside* the subagent (PostToolUse, SubagentStop), so the row starts with a
 * placeholder id and is rebound to the real one on first sight.
 */
export declare const PENDING_SUBAGENT_PREFIX = "pending:";
/** True for a row that has not yet been bound to a Claude Code agent id. */
export declare function isPendingSubagentId(id: string): boolean;
/** A persisted subagent row. Mirrors the `subagents` table. */
export interface SubagentRecord {
    id: string;
    sessionId: string;
    agentType?: string;
    model?: string;
    startedAt: string;
    endedAt?: string;
    toolCallCount: number;
    failureCount: number;
}
export interface NewSubagent {
    id: string;
    sessionId: string;
    agentType?: string;
    model?: string;
    startedAt: string;
}
