import type { DatabaseHandle } from "./database.js";
import type { NewSession, SessionRecord, SessionStatus, UserOutcome } from "../domain/session.js";
/** Repository for reading and writing `sessions` rows. */
export declare class SessionRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToRecord;
    insertIfAbsent(session: NewSession): void;
    get(id: string): SessionRecord | undefined;
    /**
     * Find sessions whose id starts with `prefix`, comparing against the
     * dash-stripped form so that ids shown by `shortId` can be pasted back in.
     */
    findByShortPrefix(repositoryHash: string, prefix: string): SessionRecord[];
    incrementPromptCount(id: string): void;
    incrementToolCall(id: string, failed: boolean): void;
    incrementSubagentCount(id: string): void;
    incrementCompactCount(id: string): void;
    markEnded(id: string, endedAt: string, status?: SessionStatus): void;
    setMainModel(id: string, model: string): void;
    setUserOutcome(id: string, outcome: UserOutcome): void;
    latestCompleted(repositoryHash: string): SessionRecord | undefined;
    /** Most recent session for a repository, regardless of status. */
    latest(repositoryHash: string): SessionRecord | undefined;
    latestCompletedUnlabelled(repositoryHash: string): SessionRecord | undefined;
    listByRepo(repositoryHash: string, limit?: number): SessionRecord[];
    listSince(isoTimestamp: string): SessionRecord[];
}
