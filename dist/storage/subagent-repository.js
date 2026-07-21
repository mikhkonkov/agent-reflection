/** Repository for reading and writing `subagents` rows. */
export class SubagentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    rowToRecord(row) {
        return {
            id: row.id,
            sessionId: row.session_id,
            agentType: row.agent_type ?? undefined,
            model: row.model ?? undefined,
            startedAt: row.started_at,
            endedAt: row.ended_at ?? undefined,
            toolCallCount: row.tool_call_count,
            failureCount: row.failure_count,
        };
    }
    insertIfAbsent(sub) {
        this.db
            .prepare(`INSERT OR IGNORE INTO subagents (
          id, session_id, agent_type, model, started_at,
          tool_call_count, failure_count
        ) VALUES (
          @id, @sessionId, @agentType, @model, @startedAt, 0, 0
        )`)
            .run({
            id: sub.id,
            sessionId: sub.sessionId,
            agentType: sub.agentType ?? null,
            model: sub.model ?? null,
            startedAt: sub.startedAt,
        });
    }
    get(id) {
        const row = this.db
            .prepare(`SELECT * FROM subagents WHERE id = ?`)
            .get(id);
        return row === undefined ? undefined : this.rowToRecord(row);
    }
    markEnded(id, endedAt) {
        this.db
            .prepare(`UPDATE subagents SET ended_at = @endedAt WHERE id = @id`)
            .run({ id, endedAt });
    }
    incrementToolCall(id, failed) {
        this.db
            .prepare(`UPDATE subagents SET
          tool_call_count = tool_call_count + 1,
          failure_count = failure_count + @failedInc
        WHERE id = @id`)
            .run({ id, failedInc: failed ? 1 : 0 });
    }
    setModel(id, model) {
        this.db
            .prepare(`UPDATE subagents SET model = @model WHERE id = @id AND model IS NULL`)
            .run({ id, model });
    }
    listBySession(sessionId) {
        const rows = this.db
            .prepare(`SELECT * FROM subagents WHERE session_id = ? ORDER BY started_at ASC`)
            .all(sessionId);
        return rows.map((row) => this.rowToRecord(row));
    }
}
//# sourceMappingURL=subagent-repository.js.map