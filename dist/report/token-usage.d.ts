import { type ModelTokenUsage } from "../domain/token-usage.js";
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
 *
 * One API response is written as several transcript lines (one per content
 * block), and every one of those lines repeats the same `usage` object —
 * counting each line would inflate every counter. Lines are deduplicated
 * globally (not per model/scope) on the entry's top-level `requestId`,
 * falling back to `message.id` when `requestId` is absent; a line with
 * neither is counted, since dropping real spend is worse than a rare
 * over-count. Mirrors `scan_transcript` in `statusline/meter.sh`.
 */
export declare function readTokenUsage(transcriptPath: string | undefined): ModelTokenUsage[];
/**
 * The main-context model that burned the most tokens, or undefined when the
 * transcript yielded no main-scope usage. Used as a fallback when the
 * SessionStart hook payload carried no `model` field.
 */
export declare function dominantMainModel(usage: ModelTokenUsage[]): string | undefined;
