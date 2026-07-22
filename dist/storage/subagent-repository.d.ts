import type { DatabaseHandle } from "./database.js";
import type { NewSubagent, SubagentRecord } from "../domain/subagent.js";
/** Repository for reading and writing `subagents` rows. */
export declare class SubagentRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToRecord;
    insertIfAbsent(sub: NewSubagent): void;
    /**
     * Make sure a row exists for a real Claude Code `agent_id`.
     *
     * The launching `Task` PreToolUse knows the agent *type* but not the id, so
     * it leaves a `pending:` row behind; the subagent's own events know the id
     * but not the type. Bind them by claiming the session's oldest unbound row —
     * i.e. spawn order. Concurrent `Task` calls can swap types between siblings,
     * which is the same class of approximation as the SubagentStop fallback
     * below. When nothing is pending (nested or otherwise unobserved agents),
     * insert a bare row so its tool calls are still counted.
     */
    ensure(id: string, sessionId: string, startedAt: string): void;
    get(id: string): SubagentRecord | undefined;
    markEnded(id: string, endedAt: string): void;
    incrementToolCall(id: string, failed: boolean): void;
    setModel(id: string, model: string): void;
    listBySession(sessionId: string): SubagentRecord[];
}
