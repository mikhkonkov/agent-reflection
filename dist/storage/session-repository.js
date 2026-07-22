/** Repository for reading and writing `sessions` rows. */
export class SessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    rowToRecord(row) {
        return {
            id: row.id,
            repositoryHash: row.repository_hash,
            repositoryName: row.repository_name,
            gitBranch: row.git_branch ?? undefined,
            startedAt: row.started_at,
            endedAt: row.ended_at ?? undefined,
            mainModel: row.main_model ?? undefined,
            source: row.source ?? undefined,
            promptCount: row.prompt_count,
            toolCallCount: row.tool_call_count,
            toolFailureCount: row.tool_failure_count,
            subagentCount: row.subagent_count,
            compactCount: row.compact_count,
            status: row.status,
            transcriptPath: row.transcript_path ?? undefined,
            createdAt: row.created_at,
        };
    }
    insertIfAbsent(session) {
        this.db
            .prepare(`INSERT OR IGNORE INTO sessions (
          id, repository_hash, repository_name, git_branch, started_at,
          main_model, source, prompt_count, tool_call_count,
          tool_failure_count, subagent_count, compact_count, status,
          created_at
        ) VALUES (
          @id, @repositoryHash, @repositoryName, @gitBranch, @startedAt,
          @mainModel, @source, 0, 0, 0, 0, 0, 'active', @createdAt
        )`)
            .run({
            id: session.id,
            repositoryHash: session.repositoryHash,
            repositoryName: session.repositoryName,
            gitBranch: session.gitBranch ?? null,
            startedAt: session.startedAt,
            mainModel: session.mainModel ?? null,
            source: session.source ?? null,
            createdAt: session.createdAt,
        });
    }
    get(id) {
        const row = this.db
            .prepare(`SELECT * FROM sessions WHERE id = ?`)
            .get(id);
        return row === undefined ? undefined : this.rowToRecord(row);
    }
    /**
     * Find sessions whose id starts with `prefix`, comparing against the
     * dash-stripped form so that ids shown by `shortId` can be pasted back in.
     */
    findByShortPrefix(repositoryHash, prefix) {
        const normalized = prefix.replace(/-/g, "").toLowerCase();
        // Guard against LIKE wildcards (`%`, `_`) reaching the query.
        if (!/^[0-9a-f]+$/.test(normalized))
            return [];
        const rows = this.db
            .prepare(`SELECT * FROM sessions
         WHERE repository_hash = ? AND REPLACE(LOWER(id), '-', '') LIKE ? || '%'
         ORDER BY started_at DESC`)
            .all(repositoryHash, normalized);
        return rows.map((row) => this.rowToRecord(row));
    }
    incrementPromptCount(id) {
        this.db
            .prepare(`UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = ?`)
            .run(id);
    }
    incrementToolCall(id, failed) {
        this.db
            .prepare(`UPDATE sessions SET
          tool_call_count = tool_call_count + 1,
          tool_failure_count = tool_failure_count + @failedInc
        WHERE id = @id`)
            .run({ id, failedInc: failed ? 1 : 0 });
    }
    incrementSubagentCount(id) {
        this.db
            .prepare(`UPDATE sessions SET subagent_count = subagent_count + 1 WHERE id = ?`)
            .run(id);
    }
    incrementCompactCount(id) {
        this.db
            .prepare(`UPDATE sessions SET compact_count = compact_count + 1 WHERE id = ?`)
            .run(id);
    }
    markEnded(id, endedAt, status = "completed") {
        this.db
            .prepare(`UPDATE sessions SET ended_at = @endedAt, status = @status WHERE id = @id`)
            .run({ id, endedAt, status });
    }
    setMainModel(id, model) {
        this.db
            .prepare(`UPDATE sessions SET main_model = @model WHERE id = @id AND main_model IS NULL`)
            .run({ id, model });
    }
    /** Record the transcript path once; later hooks repeat the same value. */
    setTranscriptPath(id, transcriptPath) {
        this.db
            .prepare(`UPDATE sessions SET transcript_path = @transcriptPath
         WHERE id = @id AND (transcript_path IS NULL OR transcript_path != @transcriptPath)`)
            .run({ id, transcriptPath });
    }
    latestCompleted(repositoryHash) {
        const row = this.db
            .prepare(`SELECT * FROM sessions
         WHERE repository_hash = ? AND status = 'completed'
         ORDER BY started_at DESC LIMIT 1`)
            .get(repositoryHash);
        return row === undefined ? undefined : this.rowToRecord(row);
    }
    /** Most recent session for a repository, regardless of status. */
    latest(repositoryHash) {
        const row = this.db
            .prepare(`SELECT * FROM sessions
         WHERE repository_hash = ?
         ORDER BY started_at DESC LIMIT 1`)
            .get(repositoryHash);
        return row === undefined ? undefined : this.rowToRecord(row);
    }
    /** Most recently started session that has not ended yet. */
    latestActive(repositoryHash) {
        const row = this.db
            .prepare(`SELECT * FROM sessions
         WHERE repository_hash = ? AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`)
            .get(repositoryHash);
        return row === undefined ? undefined : this.rowToRecord(row);
    }
    listByRepo(repositoryHash, limit) {
        const rows = limit === undefined
            ? this.db
                .prepare(`SELECT * FROM sessions WHERE repository_hash = ? ORDER BY started_at DESC`)
                .all(repositoryHash)
            : this.db
                .prepare(`SELECT * FROM sessions WHERE repository_hash = ?
               ORDER BY started_at DESC LIMIT ?`)
                .all(repositoryHash, limit);
        return rows.map((row) => this.rowToRecord(row));
    }
    listSince(isoTimestamp) {
        const rows = this.db
            .prepare(`SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at DESC`)
            .all(isoTimestamp);
        return rows.map((row) => this.rowToRecord(row));
    }
}
//# sourceMappingURL=session-repository.js.map