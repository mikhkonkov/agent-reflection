/** Resolved storage locations for a single repository. */
export interface StoragePaths {
    /** Absolute path to the repository root. */
    repoRoot: string;
    /** Stable SHA-256 of the absolute repository root path. */
    repositoryHash: string;
    /** Repository directory basename. */
    repositoryName: string;
    /** Root of the .agent-reflection storage tree (repo-local or fallback). */
    baseDir: string;
    dbPath: string;
    configPath: string;
    eventsDir: string;
    reportsDir: string;
    /** True when using the ~/.agent-reflection fallback rather than repo-local. */
    usingFallback: boolean;
}
/**
 * Find the repository root by walking up from `startDir` looking for a `.git`
 * entry. Falls back to `startDir` itself when none is found.
 */
export declare function findRepoRoot(startDir: string): string;
/**
 * Resolve all storage paths for the repository containing `cwd`.
 * Prefers `<repo>/.agent-reflection`; if that location is not writable, falls back
 * to `~/.agent-reflection/projects/<repository-hash>` (the absolute path is never
 * embedded in the fallback directory name).
 */
export declare function resolveStoragePaths(cwd: string): StoragePaths;
/** Ensure the storage directory tree exists. */
export declare function ensureStorageDirs(paths: StoragePaths): void;
/**
 * Best-effort local git branch lookup. Returns undefined on any failure and
 * never throws or touches the network.
 */
export declare function detectGitBranch(repoRoot: string): string | undefined;
/**
 * Convert an absolute or relative path to a repo-relative path when it is safely
 * inside the repo root. Returns undefined for paths outside the repo (which must
 * not be persisted as-is).
 */
export declare function toRepoRelative(inputPath: string, repoRoot: string): string | undefined;
