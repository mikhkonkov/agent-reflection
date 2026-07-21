import { resolveStoragePaths, ensureStorageDirs } from "../shared/paths.js";
import { loadConfig } from "../config/config-service.js";
import { openDatabase } from "../storage/database.js";
/**
 * Resolve storage paths for `cwd`, ensure the storage tree exists, load config,
 * and open the (migrated) database. Callers are responsible for closing `db`
 * when done.
 */
export function openRepo(cwd = process.cwd()) {
    const paths = resolveStoragePaths(cwd);
    ensureStorageDirs(paths);
    const config = loadConfig(paths.configPath);
    const db = openDatabase(paths.dbPath);
    return { paths, config, db };
}
//# sourceMappingURL=context.js.map