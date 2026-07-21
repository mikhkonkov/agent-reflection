import type { DatabaseHandle } from "./database.js";
import type { NewSession, SessionRecord, SessionStatus, UserOutcome } from "../domain/session.js";
/** Repository for reading and writing `sessions` rows. */
export declare class SessionRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToRecord;
    insertIfAbsent(session: NewSession): void;
    get(id: string): SessionRecord | undefined;
    incrementPromptCount(id: string): void;
    incrementToolCall(id: string, failed: boolean): void;
    incrementSubagentCount(id: string): void;
    incrementCompactCount(id: string): void;
    markEnded(id: string, endedAt: string, status?: SessionStatus): void;
    setMainModel(id: string, model: string): void;
    setUserOutcome(id: string, outcome: UserOutcome): void;
    latestCompleted(repositoryHash: string): SessionRecord | undefined;
    latestCompletedUnlabelled(repositoryHash: string): SessionRecord | undefined;
    listByRepo(repositoryHash: string, limit?: number): SessionRecord[];
    listSince(isoTimestamp: string): SessionRecord[];
}
