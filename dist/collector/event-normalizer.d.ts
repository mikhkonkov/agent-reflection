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
 * True when tool_response indicates the tool call failed. Checks, in order:
 * an explicit `is_error === true`, presence of a non-null `error` field, or a
 * string/serialized-object match against a generic failure-text pattern (this
 * also covers a `stderr` string field, since it appears in the serialization).
 */
export declare function isToolFailure(payload: ToolResultPayload): boolean;
/** Categorize a tool failure by inspecting tool_name and tool_response text. */
export declare function categorizeError(payload: ToolResultPayload): ErrorCategory;
/** Stable, irreversible hash of prompt text — used instead of storing text. */
export declare function hashPrompt(prompt: string): string;
/**
 * Map a validated raw hook payload to a NormalizedEvent, or null when the event
 * carries no telemetry we record (e.g. PreToolUse for a non-Task tool).
 */
export declare function normalizeEvent(raw: RawHook, ctx: NormalizeContext): NormalizedEvent | null;
