import { z } from "zod";
/**
 * Permissive schema for raw hook payloads sent by Claude Code on stdin.
 * Only `hook_event_name` is required; `session_id` is optional so we can guard
 * for a missing id rather than crash. `.passthrough()` keeps every other field
 * (which varies per event) available to the normalizer via typed getters below.
 */
export const rawHookSchema = z
    .object({
    hook_event_name: z.string(),
    session_id: z.string().optional(),
})
    .passthrough();
/** Safe-parse arbitrary stdin JSON into a `RawHook`. Never throws. */
export function parseHookInput(raw) {
    const result = rawHookSchema.safeParse(raw);
    if (!result.success)
        return { ok: false };
    return { ok: true, value: result.data };
}
/** Narrow an unknown record's field to a string, or undefined when absent/wrong type. */
export function getString(obj, key) {
    const value = obj[key];
    return typeof value === "string" ? value : undefined;
}
/** Narrow an unknown record's field to a number, or undefined when absent/wrong type. */
export function getNumber(obj, key) {
    const value = obj[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
/** Narrow an unknown record's field to a boolean, or undefined when absent/wrong type. */
export function getBoolean(obj, key) {
    const value = obj[key];
    return typeof value === "boolean" ? value : undefined;
}
/**
 * Narrow an unknown record's field to a plain object (not array, not null), or
 * undefined when absent/wrong type.
 */
export function getObject(obj, key) {
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return undefined;
}
/** Narrow an unknown value to a Record<string, unknown>, or undefined otherwise. */
export function asRecord(value) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return undefined;
}
//# sourceMappingURL=hook-input-schema.js.map