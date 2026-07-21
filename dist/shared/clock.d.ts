/**
 * Injectable clock so report generation and tests are deterministic.
 * Reports themselves must not embed wall-clock time; the clock is only for
 * bookkeeping columns (created_at) that never appear in rendered report bodies.
 */
export interface Clock {
    /** Current time as an ISO-8601 string. */
    nowIso(): string;
    /** Current time as epoch milliseconds. */
    nowMs(): number;
}
export declare const systemClock: Clock;
/** A fixed clock for tests. */
export declare function fixedClock(iso: string): Clock;
