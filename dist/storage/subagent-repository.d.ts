import type { DatabaseHandle } from "./database.js";
import type { NewSubagent, SubagentRecord } from "../domain/subagent.js";
/** Repository for reading and writing `subagents` rows. */
export declare class SubagentRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToRecord;
    insertIfAbsent(sub: NewSubagent): void;
    get(id: string): SubagentRecord | undefined;
    markEnded(id: string, endedAt: string): void;
    incrementToolCall(id: string, failed: boolean): void;
    setModel(id: string, model: string): void;
    listBySession(sessionId: string): SubagentRecord[];
}
