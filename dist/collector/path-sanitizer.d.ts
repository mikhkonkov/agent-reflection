/**
 * Extract repo-relative paths referenced by a tool_input payload. Any path that
 * resolves outside the repository root is dropped (never persisted). Results are
 * deduped, order-preserving, and capped at 20 entries.
 */
export declare function extractRelativePaths(toolInput: unknown, repoRoot: string): string[];
/** Count of repo-relative paths referenced by a tool_input payload. */
export declare function countPaths(toolInput: unknown, repoRoot: string): number;
