export type SessionStatus = "active" | "completed";
/**
 * A persisted session row. Mirrors the `sessions` table. Counters are maintained
 * incrementally as events arrive.
 */
export interface SessionRecord {
    id: string;
    repositoryHash: string;
    repositoryName: string;
    gitBranch?: string;
    startedAt: string;
    endedAt?: string;
    mainModel?: string;
    /** Claude Code session source: startup | resume | clear | compact | unknown. */
    source?: string;
    promptCount: number;
    toolCallCount: number;
    toolFailureCount: number;
    subagentCount: number;
    compactCount: number;
    status: SessionStatus;
    /**
     * Absolute path to Claude Code's transcript for this session — the only
     * source of per-model token usage. Local-only: never rendered into a report.
     */
    transcriptPath?: string;
    createdAt: string;
}
/** Fields required to create a new session row. */
export interface NewSession {
    id: string;
    repositoryHash: string;
    repositoryName: string;
    gitBranch?: string;
    startedAt: string;
    mainModel?: string;
    source?: string;
    createdAt: string;
}
