import { existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, isAbsolute, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { sha256Hex } from "./ids.js";

/** Resolved storage locations for a single repository. */
export interface StoragePaths {
  /** Absolute path to the repository root. */
  repoRoot: string;
  /** Stable SHA-256 of the absolute repository root path. */
  repositoryHash: string;
  /** Repository directory basename. */
  repositoryName: string;
  /** Root of the .agent-auditor storage tree (repo-local or fallback). */
  baseDir: string;
  dbPath: string;
  configPath: string;
  eventsDir: string;
  reportsDir: string;
  /** True when using the ~/.agent-auditor fallback rather than repo-local. */
  usingFallback: boolean;
}

const DIR_NAME = ".agent-auditor";

/**
 * Find the repository root by walking up from `startDir` looking for a `.git`
 * entry. Falls back to `startDir` itself when none is found.
 */
export function findRepoRoot(startDir: string): string {
  let current = resolve(startDir);
  for (;;) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}

function isWritable(dir: string): boolean {
  try {
    // Writable if the directory exists and is writable, or its parent is.
    if (existsSync(dir)) {
      accessSync(dir, constants.W_OK);
      return true;
    }
    accessSync(dirname(dir), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve all storage paths for the repository containing `cwd`.
 * Prefers `<repo>/.agent-auditor`; if that location is not writable, falls back
 * to `~/.agent-auditor/projects/<repository-hash>` (the absolute path is never
 * embedded in the fallback directory name).
 */
export function resolveStoragePaths(cwd: string): StoragePaths {
  const repoRoot = findRepoRoot(cwd);
  const repositoryHash = sha256Hex(repoRoot);
  const repositoryName = basename(repoRoot) || "repository";

  const repoLocal = join(repoRoot, DIR_NAME);
  let baseDir: string;
  let usingFallback: boolean;

  if (isWritable(repoLocal)) {
    baseDir = repoLocal;
    usingFallback = false;
  } else {
    baseDir = join(homedir(), DIR_NAME, "projects", repositoryHash);
    usingFallback = true;
  }

  return {
    repoRoot,
    repositoryHash,
    repositoryName,
    baseDir,
    dbPath: join(baseDir, "agent-auditor.db"),
    configPath: join(baseDir, "config.json"),
    eventsDir: join(baseDir, "events"),
    reportsDir: join(baseDir, "reports"),
    usingFallback,
  };
}

/** Ensure the storage directory tree exists. */
export function ensureStorageDirs(paths: StoragePaths): void {
  mkdirSync(paths.baseDir, { recursive: true });
  mkdirSync(paths.eventsDir, { recursive: true });
  mkdirSync(paths.reportsDir, { recursive: true });
}

/**
 * Best-effort local git branch lookup. Returns undefined on any failure and
 * never throws or touches the network.
 */
export function detectGitBranch(repoRoot: string): string | undefined {
  try {
    const out = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    });
    const branch = out.trim();
    return branch.length > 0 && branch !== "HEAD" ? branch : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert an absolute or relative path to a repo-relative path when it is safely
 * inside the repo root. Returns undefined for paths outside the repo (which must
 * not be persisted as-is).
 */
export function toRepoRelative(inputPath: string, repoRoot: string): string | undefined {
  if (!inputPath) return undefined;
  const abs = isAbsolute(inputPath) ? inputPath : resolve(repoRoot, inputPath);
  const rel = relative(repoRoot, abs);
  if (rel === "" ) return ".";
  if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return rel.split("\\").join("/");
}
