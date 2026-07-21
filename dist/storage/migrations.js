/**
 * Ordered list of migrations. Each entry's index + 1 is its schema version
 * (tracked via `PRAGMA user_version`). Migrations must be additive and safe
 * to run inside a single transaction.
 */
const MIGRATIONS = [
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
];
/** Read the current `PRAGMA user_version` as a number. */
function getUserVersion(db) {
    return db.pragma("user_version", { simple: true });
}
/**
 * Apply any migrations newer than the database's current `user_version`,
 * inside a single transaction, then bump `user_version`. Idempotent: running
 * this against an already-migrated database is a no-op.
 */
export function runMigrations(db) {
    const currentVersion = getUserVersion(db);
    if (currentVersion >= MIGRATIONS.length) {
        return;
    }
    const applyPending = db.transaction(() => {
        for (let version = currentVersion; version < MIGRATIONS.length; version++) {
            const migration = MIGRATIONS[version];
            if (migration === undefined)
                continue;
            db.exec(migration);
        }
        db.pragma(`user_version = ${MIGRATIONS.length}`);
    });
    applyPending();
}
//# sourceMappingURL=migrations.js.map