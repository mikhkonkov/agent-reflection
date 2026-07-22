import type { DatabaseHandle } from "./database.js";
import type { NewSession, SessionRecord, SessionStatus } from "../domain/session.js";
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
    /**
     * Claude Code emits SessionEnd for non-terminal reasons too (`prompt_input_exit`
     * fires while the conversation keeps going), so a later event for the same
     * session id means it never actually ended. Without this, `report current`
     * finds no active session for the rest of the conversation.
     */
    reopenIfEnded(id: string): void;
    setMainModel(id: string, model: string): void;
    /** Record the transcript path once; later hooks repeat the same value. */
    setTranscriptPath(id: string, transcriptPath: string): void;
    latestCompleted(repositoryHash: string): SessionRecord | undefined;
    /** Most recent session for a repository, regardless of status. */
    latest(repositoryHash: string): SessionRecord | undefined;
    /** Most recently started session that has not ended yet. */
    latestActive(repositoryHash: string): SessionRecord | undefined;
    listByRepo(repositoryHash: string, limit?: number): SessionRecord[];
    listSince(isoTimestamp: string): SessionRecord[];
}
