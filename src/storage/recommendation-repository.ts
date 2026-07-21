import type { DatabaseHandle } from "./database.js";
import type { Recommendation, RecommendationRecord } from "../domain/recommendation.js";

/** Raw shape of a row from the `recommendations` table. */
interface RecommendationRow {
  id: number;
  session_id: string;
  rule_id: string;
  severity: string;
  confidence: number;
  title: string;
  rationale: string;
  suggested_action: string;
  command: string | null;
  evidence_json: string;
  created_at: string;
}

/** Aggregate row shape for `countByRuleSince`. */
interface RuleCountRow {
  rule_id: string;
  count: number;
}

/** Parse `evidence_json`, guarding against malformed or non-object content. */
function parseEvidence(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Repository for reading and writing `recommendations` rows. */
export class RecommendationRepository {
  private readonly db: DatabaseHandle;

  constructor(db: DatabaseHandle) {
    this.db = db;
  }

  private rowToRecord(row: RecommendationRow): RecommendationRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      ruleId: row.rule_id,
      severity: row.severity as RecommendationRecord["severity"],
      confidence: row.confidence,
      title: row.title,
      rationale: row.rationale,
      suggestedAction: row.suggested_action,
      command: row.command ?? undefined,
      evidence: parseEvidence(row.evidence_json),
      createdAt: row.created_at,
    };
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare(`DELETE FROM recommendations WHERE session_id = ?`).run(sessionId);
  }

  insertMany(sessionId: string, recs: Recommendation[], createdAt: string): void {
    const insert = this.db.prepare(
      `INSERT INTO recommendations (
        session_id, rule_id, severity, confidence, title, rationale,
        suggested_action, command, evidence_json, created_at
      ) VALUES (
        @sessionId, @ruleId, @severity, @confidence, @title, @rationale,
        @suggestedAction, @command, @evidenceJson, @createdAt
      )`,
    );

    const insertAll = this.db.transaction((items: Recommendation[]): void => {
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

  listBySession(sessionId: string): RecommendationRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM recommendations WHERE session_id = ? ORDER BY id ASC`)
      .all(sessionId) as RecommendationRow[];
    return rows.map((row) => this.rowToRecord(row));
  }

  countByRuleSince(isoTimestamp: string): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT r.rule_id as rule_id, COUNT(*) as count
         FROM recommendations r
         JOIN sessions s ON s.id = r.session_id
         WHERE s.started_at >= ?
         GROUP BY r.rule_id`,
      )
      .all(isoTimestamp) as RuleCountRow[];

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.rule_id] = row.count;
    }
    return result;
  }
}
