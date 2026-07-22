import type { DatabaseHandle } from "./database.js";
import type { NewSubagent, SubagentRecord } from "../domain/subagent.js";
import { PENDING_SUBAGENT_PREFIX } from "../domain/subagent.js";

/** Raw shape of a row from the `subagents` table. */
interface SubagentRow {
  id: string;
  session_id: string;
  agent_type: string | null;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  tool_call_count: number;
  failure_count: number;
}

/** Repository for reading and writing `subagents` rows. */
export class SubagentRepository {
  private readonly db: DatabaseHandle;

  constructor(db: DatabaseHandle) {
    this.db = db;
  }

  private rowToRecord(row: SubagentRow): SubagentRecord {
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

  insertIfAbsent(sub: NewSubagent): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO subagents (
          id, session_id, agent_type, model, started_at,
          tool_call_count, failure_count
        ) VALUES (
          @id, @sessionId, @agentType, @model, @startedAt, 0, 0
        )`,
      )
      .run({
        id: sub.id,
        sessionId: sub.sessionId,
        agentType: sub.agentType ?? null,
        model: sub.model ?? null,
        startedAt: sub.startedAt,
      });
  }

  /**
   * Make sure a row exists for a real Claude Code `agent_id`.
   *
   * The launching `Task` PreToolUse knows the agent *type* but not the id, so
   * it leaves a `pending:` row behind; the subagent's own events know the id
   * but not the type. Bind them by claiming the session's oldest unbound row —
   * i.e. spawn order. Concurrent `Task` calls can swap types between siblings,
   * which is the same class of approximation as the SubagentStop fallback
   * below. When nothing is pending (nested or otherwise unobserved agents),
   * insert a bare row so its tool calls are still counted.
   */
  ensure(id: string, sessionId: string, startedAt: string): void {
    if (this.get(id) !== undefined) return;

    const claimed = this.db
      .prepare(
        `UPDATE subagents SET id = @id
         WHERE id = (
           SELECT id FROM subagents
           WHERE session_id = @sessionId AND id LIKE '${PENDING_SUBAGENT_PREFIX}%'
           ORDER BY started_at ASC LIMIT 1
         )`,
      )
      .run({ id, sessionId });
    if (claimed.changes > 0) return;

    this.insertIfAbsent({ id, sessionId, startedAt });
  }

  get(id: string): SubagentRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM subagents WHERE id = ?`)
      .get(id) as SubagentRow | undefined;
    return row === undefined ? undefined : this.rowToRecord(row);
  }

  markEnded(id: string, endedAt: string): void {
    this.db
      .prepare(`UPDATE subagents SET ended_at = @endedAt WHERE id = @id`)
      .run({ id, endedAt });
  }

  incrementToolCall(id: string, failed: boolean): void {
    this.db
      .prepare(
        `UPDATE subagents SET
          tool_call_count = tool_call_count + 1,
          failure_count = failure_count + @failedInc
        WHERE id = @id`,
      )
      .run({ id, failedInc: failed ? 1 : 0 });
  }

  listBySession(sessionId: string): SubagentRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM subagents WHERE session_id = ? ORDER BY started_at ASC`)
      .all(sessionId) as SubagentRow[];
    return rows.map((row) => this.rowToRecord(row));
  }
}
