import type { DatabaseHandle } from "./database.js";

/**
 * Ordered list of migrations. Each entry's index + 1 is its schema version
 * (tracked via `PRAGMA user_version`). Migrations must be additive and safe
 * to run inside a single transaction.
 */
const MIGRATIONS: readonly string[] = [
  // Migration 1: initial schema.
  `
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    repository_hash TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    git_branch TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    main_model TEXT,
    source TEXT,
    prompt_count INTEGER NOT NULL DEFAULT 0,
    tool_call_count INTEGER NOT NULL DEFAULT 0,
    tool_failure_count INTEGER NOT NULL DEFAULT 0,
    subagent_count INTEGER NOT NULL DEFAULT 0,
    compact_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    user_outcome TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    event_name TEXT NOT NULL,
    tool_name TEXT,
    tool_classification TEXT,
    occurred_at TEXT NOT NULL,
    duration_ms INTEGER,
    success INTEGER,
    input_size INTEGER,
    output_size INTEGER,
    path_count INTEGER,
    error_category TEXT,
    compaction_trigger TEXT,
    metadata_json TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
  CREATE TABLE subagents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_type TEXT,
    model TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    tool_call_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
  CREATE TABLE recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence REAL NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
  CREATE INDEX idx_events_session_time ON events(session_id, occurred_at);
  CREATE INDEX idx_sessions_repo_time ON sessions(repository_hash, started_at);
  CREATE INDEX idx_recommendations_session ON recommendations(session_id);
  CREATE INDEX idx_subagents_session ON subagents(session_id);
  `,
  // Migration 2: persist the sanitized repo-relative paths touched by an event.
  // Only `path_count` was stored before, so rules could count paths but never
  // name them (e.g. the repeated-failure rule always reported an empty file
  // list). Stored as a JSON array; always repo-relative, never absolute.
  `
  ALTER TABLE events ADD COLUMN relative_paths TEXT;
  `,
  // Migration 3: remember where Claude Code stores this session's transcript.
  // The transcript is the only source of per-model token usage; the hook
  // payload carries the path, so it is captured once and read at report time.
  // This is a local absolute path to a file the user already owns — it is
  // never rendered into a report.
  `
  ALTER TABLE sessions ADD COLUMN transcript_path TEXT;
  `,
  // Migration 4: the copy-pasteable command backing a recommendation's action.
  `
  ALTER TABLE recommendations ADD COLUMN command TEXT;
  `,
];

/** Read the current `PRAGMA user_version` as a number. */
function getUserVersion(db: DatabaseHandle): number {
  return db.pragma("user_version", { simple: true }) as number;
}

/**
 * Apply any migrations newer than the database's current `user_version`,
 * inside a single transaction, then bump `user_version`. Idempotent: running
 * this against an already-migrated database is a no-op.
 */
export function runMigrations(db: DatabaseHandle): void {
  const currentVersion = getUserVersion(db);
  if (currentVersion >= MIGRATIONS.length) {
    return;
  }

  const applyPending = db.transaction(() => {
    for (let version = currentVersion; version < MIGRATIONS.length; version++) {
      const migration = MIGRATIONS[version];
      if (migration === undefined) continue;
      db.exec(migration);
    }
    db.pragma(`user_version = ${MIGRATIONS.length}`);
  });

  applyPending();
}
