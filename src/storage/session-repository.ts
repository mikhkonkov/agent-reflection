import type { DatabaseHandle } from "./database.js";
import type { NewSession, SessionRecord, SessionStatus } from "../domain/session.js";

/** Raw shape of a row from the `sessions` table. */
interface SessionRow {
  id: string;
  repository_hash: string;
  repository_name: string;
  git_branch: string | null;
  started_at: string;
  ended_at: string | null;
  main_model: string | null;
  source: string | null;
  prompt_count: number;
  tool_call_count: number;
  tool_failure_count: number;
  subagent_count: number;
  compact_count: number;
  status: string;
  transcript_path: string | null;
  created_at: string;
}

/** Repository for reading and writing `sessions` rows. */
export class SessionRepository {
  private readonly db: DatabaseHandle;

  constructor(db: DatabaseHandle) {
    this.db = db;
  }

  private rowToRecord(row: SessionRow): SessionRecord {
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
      status: row.status as SessionStatus,
      transcriptPath: row.transcript_path ?? undefined,
      createdAt: row.created_at,
    };
  }

  insertIfAbsent(session: NewSession): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions (
          id, repository_hash, repository_name, git_branch, started_at,
          main_model, source, prompt_count, tool_call_count,
          tool_failure_count, subagent_count, compact_count, status,
          created_at
        ) VALUES (
          @id, @repositoryHash, @repositoryName, @gitBranch, @startedAt,
          @mainModel, @source, 0, 0, 0, 0, 0, 'active', @createdAt
        )`,
      )
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

  get(id: string): SessionRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(id) as SessionRow | undefined;
    return row === undefined ? undefined : this.rowToRecord(row);
  }

  /**
   * Find sessions whose id starts with `prefix`, comparing against the
   * dash-stripped form so that ids shown by `shortId` can be pasted back in.
   */
  findByShortPrefix(repositoryHash: string, prefix: string): SessionRecord[] {
    const normalized = prefix.replace(/-/g, "").toLowerCase();
    // Guard against LIKE wildcards (`%`, `_`) reaching the query.
    if (!/^[0-9a-f]+$/.test(normalized)) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE repository_hash = ? AND REPLACE(LOWER(id), '-', '') LIKE ? || '%'
         ORDER BY started_at DESC`,
      )
      .all(repositoryHash, normalized) as SessionRow[];
    return rows.map((row) => this.rowToRecord(row));
  }

  incrementPromptCount(id: string): void {
    this.db
      .prepare(`UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = ?`)
      .run(id);
  }

  incrementToolCall(id: string, failed: boolean): void {
    this.db
      .prepare(
        `UPDATE sessions SET
          tool_call_count = tool_call_count + 1,
          tool_failure_count = tool_failure_count + @failedInc
        WHERE id = @id`,
      )
      .run({ id, failedInc: failed ? 1 : 0 });
  }

  incrementSubagentCount(id: string): void {
    this.db
      .prepare(`UPDATE sessions SET subagent_count = subagent_count + 1 WHERE id = ?`)
      .run(id);
  }

  incrementCompactCount(id: string): void {
    this.db
      .prepare(`UPDATE sessions SET compact_count = compact_count + 1 WHERE id = ?`)
      .run(id);
  }

  markEnded(id: string, endedAt: string, status: SessionStatus = "completed"): void {
    this.db
      .prepare(`UPDATE sessions SET ended_at = @endedAt, status = @status WHERE id = @id`)
      .run({ id, endedAt, status });
  }

  /**
   * Claude Code emits SessionEnd for non-terminal reasons too (`prompt_input_exit`
   * fires while the conversation keeps going), so a later event for the same
   * session id means it never actually ended. Without this, `report current`
   * finds no active session for the rest of the conversation.
   */
  reopenIfEnded(id: string): void {
    this.db
      .prepare(
        `UPDATE sessions SET ended_at = NULL, status = 'active'
         WHERE id = @id AND status = 'completed'`,
      )
      .run({ id });
  }

  setMainModel(id: string, model: string): void {
    this.db
      .prepare(
        `UPDATE sessions SET main_model = @model WHERE id = @id AND main_model IS NULL`,
      )
      .run({ id, model });
  }

  /** Record the transcript path once; later hooks repeat the same value. */
  setTranscriptPath(id: string, transcriptPath: string): void {
    this.db
      .prepare(
        `UPDATE sessions SET transcript_path = @transcriptPath
         WHERE id = @id AND (transcript_path IS NULL OR transcript_path != @transcriptPath)`,
      )
      .run({ id, transcriptPath });
  }

  latestCompleted(repositoryHash: string): SessionRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE repository_hash = ? AND status = 'completed'
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(repositoryHash) as SessionRow | undefined;
    return row === undefined ? undefined : this.rowToRecord(row);
  }

  /** Most recent session for a repository, regardless of status. */
  latest(repositoryHash: string): SessionRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE repository_hash = ?
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(repositoryHash) as SessionRow | undefined;
    return row === undefined ? undefined : this.rowToRecord(row);
  }

  /** Most recently started session that has not ended yet. */
  latestActive(repositoryHash: string): SessionRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE repository_hash = ? AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(repositoryHash) as SessionRow | undefined;
    return row === undefined ? undefined : this.rowToRecord(row);
  }

  listByRepo(repositoryHash: string, limit?: number): SessionRecord[] {
    const rows =
      limit === undefined
        ? (this.db
            .prepare(
              `SELECT * FROM sessions WHERE repository_hash = ? ORDER BY started_at DESC`,
            )
            .all(repositoryHash) as SessionRow[])
        : (this.db
            .prepare(
              `SELECT * FROM sessions WHERE repository_hash = ?
               ORDER BY started_at DESC LIMIT ?`,
            )
            .all(repositoryHash, limit) as SessionRow[]);
    return rows.map((row) => this.rowToRecord(row));
  }

  listSince(isoTimestamp: string): SessionRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at DESC`)
      .all(isoTimestamp) as SessionRow[];
    return rows.map((row) => this.rowToRecord(row));
  }
}
