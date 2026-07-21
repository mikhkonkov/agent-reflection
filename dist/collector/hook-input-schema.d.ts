import { z } from "zod";
/**
 * Permissive schema for raw hook payloads sent by Claude Code on stdin.
 * Only `hook_event_name` is required; `session_id` is optional so we can guard
 * for a missing id rather than crash. `.passthrough()` keeps every other field
 * (which varies per event) available to the normalizer via typed getters below.
 */
export declare const rawHookSchema: z.ZodObject<{
    hook_event_name: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    hook_event_name: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    hook_event_name: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/** A validated raw hook payload. Extra fields are read via the getters below. */
export type RawHook = z.infer<typeof rawHookSchema>;
export type ParseHookInputResult = {
    ok: true;
    value: RawHook;
} | {
    ok: false;
};
/** Safe-parse arbitrary stdin JSON into a `RawHook`. Never throws. */
export declare function parseHookInput(raw: unknown): ParseHookInputResult;
/** Narrow an unknown record's field to a string, or undefined when absent/wrong type. */
export declare function getString(obj: Record<string, unknown>, key: string): string | undefined;
/** Narrow an unknown record's field to a number, or undefined when absent/wrong type. */
export declare function getNumber(obj: Record<string, unknown>, key: string): number | undefined;
/** Narrow an unknown record's field to a boolean, or undefined when absent/wrong type. */
export declare function getBoolean(obj: Record<string, unknown>, key: string): boolean | undefined;
/**
 * Narrow an unknown record's field to a plain object (not array, not null), or
 * undefined when absent/wrong type.
 */
export declare function getObject(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined;
/** Narrow an unknown value to a Record<string, unknown>, or undefined otherwise. */
export declare function asRecord(value: unknown): Record<string, unknown> | undefined;
