import BetterSqlite3 from "better-sqlite3";
/** Handle to an open SQLite database (better-sqlite3, synchronous). */
export type DatabaseHandle = BetterSqlite3.Database;
/**
 * Open (creating if absent) the file-backed database at `dbPath`, applying
 * pragmas and running migrations. Creates parent directories as needed.
 */
export declare function openDatabase(dbPath: string): DatabaseHandle;
/** Open an in-memory database (for tests): same pragmas and migrations. */
export declare function openInMemoryDatabase(): DatabaseHandle;
