import type { DatabaseHandle } from "./database.js";
/**
 * Apply any migrations newer than the database's current `user_version`,
 * inside a single transaction, then bump `user_version`. Idempotent: running
 * this against an already-migrated database is a no-op.
 */
export declare function runMigrations(db: DatabaseHandle): void;
