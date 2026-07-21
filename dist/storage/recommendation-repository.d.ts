import type { DatabaseHandle } from "./database.js";
import type { Recommendation, RecommendationRecord } from "../domain/recommendation.js";
/** Repository for reading and writing `recommendations` rows. */
export declare class RecommendationRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToRecord;
    deleteBySession(sessionId: string): void;
    insertMany(sessionId: string, recs: Recommendation[], createdAt: string): void;
    listBySession(sessionId: string): RecommendationRecord[];
    countByRuleSince(isoTimestamp: string): Record<string, number>;
}
