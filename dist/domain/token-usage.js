/** Billable tokens for a usage row: everything the API charged for. */
export function totalTokens(usage) {
    return (usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens);
}
//# sourceMappingURL=token-usage.js.map