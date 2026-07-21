import type { DatabaseHandle } from "./database.js";
import type {
  CompactionTrigger,
  ErrorCategory,
  EventName,
  NormalizedEvent,
  ToolClassification,
} from "../domain/event.js";

/** Raw shape of a row from the `events` table. */
interface EventRow {
  id: number;
  session_id: string;
  agent_id: string | null;
  event_name: string;
  tool_name: string | null;
  tool_classification: string | null;
  occurred_at: string;
  duration_ms: number | null;
  success: number | null;
  input_size: number | null;
  output_size: number | null;
  path_count: number | null;
  relative_paths: string | null;
  error_category: string | null;
  compaction_trigger: string | null;
  metadata_json: string;
}

/** Parse `metadata_json`, guarding against malformed or non-object content. */
function parseMetadata(json: string): Record<string, unknown> {
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

/** Parse the `relative_paths` JSON array, dropping anything malformed. */
function parseRelativePaths(json: string | null): string[] | undefined {
  if (json === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return undefined;
  }
}

/** Repository for reading and writing `events` rows. */
export class EventRepository {
  private readonly db: DatabaseHandle;

  constructor(db: DatabaseHandle) {
    this.db = db;
  }

  private rowToEvent(row: EventRow): NormalizedEvent {
    return {
      sessionId: row.session_id,
      agentId: row.agent_id ?? undefined,
      eventName: row.event_name as EventName,
      occurredAt: row.occurred_at,
      toolName: row.tool_name ?? undefined,
      toolClassification: (row.tool_classification as ToolClassification | null) ?? undefined,
      success: row.success === null ? undefined : row.success === 1,
      durationMs: row.duration_ms ?? undefined,
      inputSize: row.input_size ?? undefined,
      outputSize: row.output_size ?? undefined,
      pathCount: row.path_count ?? undefined,
      relativePaths: parseRelativePaths(row.relative_paths),
      errorCategory: (row.error_category as ErrorCategory | null) ?? undefined,
      compactionTrigger: (row.compaction_trigger as CompactionTrigger | null) ?? undefined,
      metadata: parseMetadata(row.metadata_json),
    };
  }

  insert(event: NormalizedEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (
          session_id, agent_id, event_name, tool_name, tool_classification,
          occurred_at, duration_ms, success, input_size, output_size,
          path_count, relative_paths, error_category, compaction_trigger, metadata_json
        ) VALUES (
          @sessionId, @agentId, @eventName, @toolName, @toolClassification,
          @occurredAt, @durationMs, @success, @inputSize, @outputSize,
          @pathCount, @relativePaths, @errorCategory, @compactionTrigger, @metadataJson
        )`,
      )
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
        relativePaths:
          event.relativePaths && event.relativePaths.length > 0
            ? JSON.stringify(event.relativePaths)
            : null,
        errorCategory: event.errorCategory ?? null,
        compactionTrigger: event.compactionTrigger ?? null,
        metadataJson: JSON.stringify(event.metadata),
      });
  }

  listBySession(sessionId: string): NormalizedEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM events WHERE session_id = ? ORDER BY occurred_at ASC, id ASC`,
      )
      .all(sessionId) as EventRow[];
    return rows.map((row) => this.rowToEvent(row));
  }

  countBySession(sessionId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM events WHERE session_id = ?`)
      .get(sessionId) as { count: number };
    return row.count;
  }
}
