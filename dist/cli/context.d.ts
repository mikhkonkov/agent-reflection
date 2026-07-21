import { type StoragePaths } from "../shared/paths.js";
import { type DatabaseHandle } from "../storage/database.js";
import type { AuditorConfig } from "../config/config-schema.js";
/** Everything a one-shot CLI command needs to operate against a repository. */
export interface RepoContext {
    paths: StoragePaths;
    config: AuditorConfig;
    db: DatabaseHandle;
}
/**
 * Resolve storage paths for `cwd`, ensure the storage tree exists, load config,
 * and open the (migrated) database. Callers are responsible for closing `db`
 * when done.
 */
export declare function openRepo(cwd?: string): RepoContext;
