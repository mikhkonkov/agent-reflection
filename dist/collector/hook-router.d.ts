import { type Clock } from "../shared/clock.js";
/**
 * Entry point for the collector: parse a raw hook payload from stdin, persist
 * telemetry, and (on SessionEnd) trigger report finalization. Must fail safe —
 * every step is inside the outer try/catch and any failure degrades to a no-op
 * exit code 0, since a telemetry problem must never block Claude Code.
 */
export declare function runHook(rawStdin: string, cwd: string, clock?: Clock): number;
