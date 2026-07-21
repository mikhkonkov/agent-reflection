/** Parse `evidence_json`, guarding against malformed or non-object content. */
function parseEvidence(json) {
    try {
        const parsed = JSON.parse(json);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
/** Repository for reading and writing `recommendations` rows. */
export class RecommendationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    rowToRecord(row) {
        return {
            id: row.id,
            sessionId: row.session_id,
            ruleId: row.rule_id,
            severity: row.severity,
            confidence: row.confidence,
            title: row.title,
            rationale: row.rationale,
            suggestedAction: row.suggested_action,
            command: row.command ?? undefined,
            evidence: parseEvidence(row.evidence_json),
            createdAt: row.created_at,
        };
    }
    deleteBySession(sessionId) {
        this.db.prepare(`DELETE FROM recommendations WHERE session_id = ?`).run(sessionId);
    }
    insertMany(sessionId, recs, createdAt) {
        const insert = this.db.prepare(`INSERT INTO recommendations (
        session_id, rule_id, severity, confidence, title, rationale,
        suggested_action, command, evidence_json, created_at
      ) VALUES (
        @sessionId, @ruleId, @severity, @confidence, @title, @rationale,
        @suggestedAction, @command, @evidenceJson, @createdAt
      )`);
        const insertAll = this.db.transaction((items) => {
            for (const rec of items) {
                insert.run({
                    sessionId,
                    ruleId: rec.ruleId,
                    severity: rec.severity,
                    confidence: rec.confidence,
                    title: rec.title,
                    rationale: rec.rationale,
                    suggestedAction: rec.suggestedAction,
                    command: rec.command ?? null,
                    evidenceJson: JSON.stringify(rec.evidence),
                    createdAt,
                });
            }
        });
        insertAll(recs);
    }
    listBySession(sessionId) {
        const rows = this.db
            .prepare(`SELECT * FROM recommendations WHERE session_id = ? ORDER BY id ASC`)
            .all(sessionId);
        return rows.map((row) => this.rowToRecord(row));
    }
    countByRuleSince(isoTimestamp) {
        const rows = this.db
            .prepare(`SELECT r.rule_id as rule_id, COUNT(*) as count
         FROM recommendations r
         JOIN sessions s ON s.id = r.session_id
         WHERE s.started_at >= ?
         GROUP BY r.rule_id`)
            .all(isoTimestamp);
        const result = {};
        for (const row of rows) {
            result[row.rule_id] = row.count;
        }
        return result;
    }
}
//# sourceMappingURL=recommendation-repository.js.map