import { readFileSync } from "node:fs";
import { totalTokens } from "../domain/token-usage.js";
/** A number field on a usage object, defaulting to 0 for absent/invalid values. */
function usageNumber(usage, key) {
    const value = usage[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function asRecord(value) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return undefined;
}
/**
 * Aggregate per-model token usage from a Claude Code transcript.
 *
 * Reads ONLY the `usage` counters and the model name off each assistant
 * message — never message content, tool inputs, or tool outputs. A missing,
 * unreadable, or malformed transcript yields an empty list rather than an
 * error: token accounting is a nice-to-have, and must never break a report.
 *
 * Synthetic assistant messages (Claude Code's own placeholders, model
 * `<synthetic>`) carry no real spend and are skipped.
 */
export function readTokenUsage(transcriptPath) {
    if (transcriptPath === undefined)
        return [];
    let raw;
    try {
        raw = readFileSync(transcriptPath, "utf8");
    }
    catch {
        return [];
    }
    const byKey = new Map();
    for (const line of raw.split("\n")) {
        if (line.trim() === "")
            continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            continue;
        }
        const entry = asRecord(parsed);
        if (!entry)
            continue;
        const message = asRecord(entry["message"]);
        if (!message)
            continue;
        const usage = asRecord(message["usage"]);
        if (!usage)
            continue;
        const model = typeof message["model"] === "string" ? message["model"] : "unknown";
        if (model === "<synthetic>")
            continue;
        const scope = entry["isSidechain"] === true ? "subagent" : "main";
        const key = `${scope}:${model}`;
        const existing = byKey.get(key) ?? {
            model,
            scope,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            messageCount: 0,
        };
        existing.inputTokens += usageNumber(usage, "input_tokens");
        existing.outputTokens += usageNumber(usage, "output_tokens");
        existing.cacheCreationTokens += usageNumber(usage, "cache_creation_input_tokens");
        existing.cacheReadTokens += usageNumber(usage, "cache_read_input_tokens");
        existing.messageCount += 1;
        byKey.set(key, existing);
    }
    // Heaviest spend first, so the expensive model is the first thing read.
    return Array.from(byKey.values()).sort((a, b) => totalTokens(b) - totalTokens(a));
}
/**
 * The main-context model that burned the most tokens, or undefined when the
 * transcript yielded no main-scope usage. Used as a fallback when the
 * SessionStart hook payload carried no `model` field.
 */
export function dominantMainModel(usage) {
    // `usage` is already sorted by total tokens descending.
    const main = usage.find((entry) => entry.scope === "main" && entry.model !== "unknown");
    return main?.model;
}
//# sourceMappingURL=token-usage.js.map