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

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};

/** A fixed clock for tests. */
export function fixedClock(iso: string): Clock {
  const ms = new Date(iso).getTime();
  return {
    nowIso: () => iso,
    nowMs: () => ms,
  };
}
