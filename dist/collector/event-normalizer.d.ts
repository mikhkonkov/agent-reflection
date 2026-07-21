import type { ErrorCategory, NormalizedEvent, PromptClass } from "../domain/event.js";
import type { AuditorConfig } from "../config/config-schema.js";
import { type RawHook } from "./hook-input-schema.js";
/** Normalization context passed alongside the raw hook payload. */
export interface NormalizeContext {
    sessionId: string;
    repoRoot: string;
    config: AuditorConfig;
    /** ISO-8601 timestamp, injected so normalization stays deterministic/testable. */
    nowIso: string;
}
/**
 * The minimal shape `categorizeError`/`isToolFailure` need from a PostToolUse
 * payload, named after the raw hook's own wire fields so test fixtures can be
 * passed through unmodified (or trivially subset from a full raw payload).
 */
export interface ToolResultPayload {
    tool_name?: string;
    tool_response?: unknown;
}
/** Classify a user prompt by keyword/shape heuristic only. Never uses an LLM. */
export declare function classifyPrompt(prompt: string): PromptClass;
/**
 * True when tool_response indicates the tool call failed.
 *
 * Ordered from authoritative to heuristic:
 *   1. `is_error === true` — the tool result's own flag.
 *   2. a non-null `error` field.
 *   3. `interrupted === true` — an aborted/timed-out execution.
 *   4. a failure marker at the start of the response text, or at the start of
 *      a `stderr` line. Never a free-text scan of the whole output: successful
 *      output routinely contains the words "error" and "failed".
 */
export declare function isToolFailure(payload: ToolResultPayload): boolean;
/** Categorize a tool failure by inspecting tool_name and tool_response text. */
export declare function categorizeError(payload: ToolResultPayload): ErrorCategory;
/** Stable, irreversible hash of prompt text — used instead of storing text. */
export declare function hashPrompt(prompt: string): string;
/**
 * Map a validated raw hook payload to a NormalizedEvent, or null when the event
 * carries no telemetry we record (e.g. PreToolUse for a non-delegation tool).
 */
export declare function normalizeEvent(raw: RawHook, ctx: NormalizeContext): NormalizedEvent | null;
