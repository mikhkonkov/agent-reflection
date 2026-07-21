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
