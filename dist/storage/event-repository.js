/** Parse `metadata_json`, guarding against malformed or non-object content. */
function parseMetadata(json) {
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
/** Parse the `relative_paths` JSON array, dropping anything malformed. */
function parseRelativePaths(json) {
    if (json === null)
        return undefined;
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed))
            return undefined;
        return parsed.filter((entry) => typeof entry === "string");
    }
    catch {
        return undefined;
    }
}
/** Repository for reading and writing `events` rows. */
export class EventRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    rowToEvent(row) {
        return {
            sessionId: row.session_id,
            agentId: row.agent_id ?? undefined,
            eventName: row.event_name,
            occurredAt: row.occurred_at,
            toolName: row.tool_name ?? undefined,
            toolClassification: row.tool_classification ?? undefined,
            success: row.success === null ? undefined : row.success === 1,
            durationMs: row.duration_ms ?? undefined,
            inputSize: row.input_size ?? undefined,
            outputSize: row.output_size ?? undefined,
            pathCount: row.path_count ?? undefined,
            relativePaths: parseRelativePaths(row.relative_paths),
            errorCategory: row.error_category ?? undefined,
            compactionTrigger: row.compaction_trigger ?? undefined,
            metadata: parseMetadata(row.metadata_json),
        };
    }
    insert(event) {
        this.db
            .prepare(`INSERT INTO events (
          session_id, agent_id, event_name, tool_name, tool_classification,
          occurred_at, duration_ms, success, input_size, output_size,
          path_count, relative_paths, error_category, compaction_trigger, metadata_json
        ) VALUES (
          @sessionId, @agentId, @eventName, @toolName, @toolClassification,
          @occurredAt, @durationMs, @success, @inputSize, @outputSize,
          @pathCount, @relativePaths, @errorCategory, @compactionTrigger, @metadataJson
        )`)
            .run({
            sessionId: event.sessionId,
            agentId: event.agentId ?? null,
            eventName: event.eventName,
            toolName: event.toolName ?? null,
            toolClassification: event.toolClassification ?? null,
            occurredAt: event.occurredAt,
            durationMs: event.durationMs ?? null,
            success: event.success === undefined ? null : event.success ? 1 : 0,
            inputSize: event.inputSize ?? null,
            outputSize: event.outputSize ?? null,
            pathCount: event.pathCount ?? event.relativePaths?.length ?? null,
            relativePaths: event.relativePaths && event.relativePaths.length > 0
                ? JSON.stringify(event.relativePaths)
                : null,
            errorCategory: event.errorCategory ?? null,
            compactionTrigger: event.compactionTrigger ?? null,
            metadataJson: JSON.stringify(event.metadata),
        });
    }
    listBySession(sessionId) {
        const rows = this.db
            .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY occurred_at ASC, id ASC`)
            .all(sessionId);
        return rows.map((row) => this.rowToEvent(row));
    }
    countBySession(sessionId) {
        const row = this.db
            .prepare(`SELECT COUNT(*) as count FROM events WHERE session_id = ?`)
            .get(sessionId);
        return row.count;
    }
}
//# sourceMappingURL=event-repository.js.map