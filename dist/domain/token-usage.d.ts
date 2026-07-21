/**
 * Token spend for one model, split by where it was spent. `main` is the
 * top-level conversation; `subagent` is everything Claude Code marks as a
 * sidechain (Task-launched agents), so the cost of delegation is visible
 * separately from the cost of the main loop.
 */
export interface ModelTokenUsage {
    model: string;
    scope: "main" | "subagent";
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    messageCount: number;
}
/** Cumulative tokens for a usage row: everything the API charged for, summed across every call. */
export declare function totalTokens(usage: ModelTokenUsage): number;
