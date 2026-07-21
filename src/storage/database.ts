import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "./migrations.js";

/** Handle to an open SQLite database (better-sqlite3, synchronous). */
export type DatabaseHandle = BetterSqlite3.Database;

/** Apply the pragmas every connection (file-backed or in-memory) must have. */
function applyPragmas(db: DatabaseHandle): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
}

/**
 * Open (creating if absent) the file-backed database at `dbPath`, applying
 * pragmas and running migrations. Creates parent directories as needed.
 */
export function openDatabase(dbPath: string): DatabaseHandle {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  applyPragmas(db);
  runMigrations(db);
  return db;
}

/** Open an in-memory database (for tests): same pragmas and migrations. */
export function openInMemoryDatabase(): DatabaseHandle {
  const db = new BetterSqlite3(":memory:");
  applyPragmas(db);
  runMigrations(db);
  return db;
}
