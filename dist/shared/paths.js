import { existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, isAbsolute, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { sha256Hex } from "./ids.js";
const DIR_NAME = ".agent-reflection";
/**
 * Find the repository root by walking up from `startDir` looking for a `.git`
 * entry. Falls back to `startDir` itself when none is found.
 */
export function findRepoRoot(startDir) {
    let current = resolve(startDir);
    for (;;) {
        if (existsSync(join(current, ".git")))
            return current;
        const parent = dirname(current);
        if (parent === current)
            return resolve(startDir);
        current = parent;
    }
}
function isWritable(dir) {
    try {
        // Writable if the directory exists and is writable, or its parent is.
        if (existsSync(dir)) {
            accessSync(dir, constants.W_OK);
            return true;
        }
        accessSync(dirname(dir), constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Resolve all storage paths for the repository containing `cwd`.
 * Prefers `<repo>/.agent-reflection`; if that location is not writable, falls back
 * to `~/.agent-reflection/projects/<repository-hash>` (the absolute path is never
 * embedded in the fallback directory name).
 */
export function resolveStoragePaths(cwd) {
    const repoRoot = findRepoRoot(cwd);
    const repositoryHash = sha256Hex(repoRoot);
    const repositoryName = basename(repoRoot) || "repository";
    const repoLocal = join(repoRoot, DIR_NAME);
    let baseDir;
    let usingFallback;
    if (isWritable(repoLocal)) {
        baseDir = repoLocal;
        usingFallback = false;
    }
    else {
        baseDir = join(homedir(), DIR_NAME, "projects", repositoryHash);
        usingFallback = true;
    }
    return {
        repoRoot,
        repositoryHash,
        repositoryName,
        baseDir,
        dbPath: join(baseDir, "agent-reflection.db"),
        configPath: join(baseDir, "config.json"),
        eventsDir: join(baseDir, "events"),
        reportsDir: join(baseDir, "reports"),
        usingFallback,
    };
}
/** Ensure the storage directory tree exists. */
export function ensureStorageDirs(paths) {
    mkdirSync(paths.baseDir, { recursive: true });
    mkdirSync(paths.eventsDir, { recursive: true });
    mkdirSync(paths.reportsDir, { recursive: true });
}
/**
 * Best-effort local git branch lookup. Returns undefined on any failure and
 * never throws or touches the network.
 */
export function detectGitBranch(repoRoot) {
    try {
        const out = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 1000,
        });
        const branch = out.trim();
        return branch.length > 0 && branch !== "HEAD" ? branch : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Convert an absolute or relative path to a repo-relative path when it is safely
 * inside the repo root. Returns undefined for paths outside the repo (which must
 * not be persisted as-is).
 */
export function toRepoRelative(inputPath, repoRoot) {
    if (!inputPath)
        return undefined;
    const abs = isAbsolute(inputPath) ? inputPath : resolve(repoRoot, inputPath);
    const rel = relative(repoRoot, abs);
    if (rel === "")
        return ".";
    if (rel.startsWith("..") || isAbsolute(rel))
        return undefined;
    return rel.split("\\").join("/");
}
//# sourceMappingURL=paths.js.map