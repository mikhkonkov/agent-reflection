import { toRepoRelative } from "../shared/paths.js";

/** Keys on a tool_input object whose value is (or may be) a single path string. */
const SINGLE_PATH_KEYS = ["file_path", "path", "notebook_path"] as const;

/** Keys on a tool_input object whose value is (or may be) an array of path strings. */
const ARRAY_PATH_KEYS = ["paths", "files"] as const;

const MAX_PATHS = 20;

/** Only characters that plausibly appear in a filesystem path, plus a glob star. */
const PATH_LIKE_RE = /^[A-Za-z0-9_.\-/*]+$/;

/**
 * Heuristic: does this string look like a path (as opposed to a regex or free-text
 * search pattern)? Used only for the `pattern` field, which Grep/Glob reuse for
 * both path-like globs and non-path regexes.
 */
function looksLikePath(value: string): boolean {
  return value.includes("/") && PATH_LIKE_RE.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Collect the raw (pre-relativization) path-like strings out of a tool_input
 * object, in a stable field order.
 */
function collectCandidates(input: Record<string, unknown>): string[] {
  const candidates: string[] = [];

  for (const key of SINGLE_PATH_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      candidates.push(value);
    }
  }

  const pattern = input["pattern"];
  if (typeof pattern === "string" && looksLikePath(pattern)) {
    candidates.push(pattern);
  }

  for (const key of ARRAY_PATH_KEYS) {
    candidates.push(...asStringArray(input[key]));
  }

  return candidates;
}

/**
 * Extract repo-relative paths referenced by a tool_input payload. Any path that
 * resolves outside the repository root is dropped (never persisted). Results are
 * deduped, order-preserving, and capped at 20 entries.
 */
export function extractRelativePaths(toolInput: unknown, repoRoot: string): string[] {
  const input = asRecord(toolInput);
  if (!input) return [];

  const candidates = collectCandidates(input);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of candidates) {
    const relative = toRepoRelative(candidate, repoRoot);
    if (relative === undefined) continue;
    if (seen.has(relative)) continue;
    seen.add(relative);
    result.push(relative);
    if (result.length >= MAX_PATHS) break;
  }

  return result;
}

/** Count of repo-relative paths referenced by a tool_input payload. */
export function countPaths(toolInput: unknown, repoRoot: string): number {
  return extractRelativePaths(toolInput, repoRoot).length;
}
