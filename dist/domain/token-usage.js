/** Cumulative tokens for a usage row: everything the API charged for, summed across every call. */
export function totalTokens(usage) {
    return (usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens);
}
//# sourceMappingURL=token-usage.js.map