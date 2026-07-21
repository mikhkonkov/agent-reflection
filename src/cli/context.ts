import { resolveStoragePaths, ensureStorageDirs, type StoragePaths } from "../shared/paths.js";
import { loadConfig } from "../config/config-service.js";
import { openDatabase, type DatabaseHandle } from "../storage/database.js";
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
export function openRepo(cwd: string = process.cwd()): RepoContext {
  const paths = resolveStoragePaths(cwd);
  ensureStorageDirs(paths);
  const config = loadConfig(paths.configPath);
  const db = openDatabase(paths.dbPath);
  return { paths, config, db };
}
