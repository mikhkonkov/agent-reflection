import type { SessionView } from "../domain/metrics.js";
import type { Recommendation } from "../domain/recommendation.js";
/** Format a millisecond duration as e.g. "18m 22s", or "unknown" when absent. */
export declare function humanDuration(ms?: number): string;
/** Format a byte count as e.g. "1.2 MB". */
export declare function humanBytes(n: number): string;
/**
 * Render the deterministic Markdown audit report for a session. Uses only
 * `view` and `recommendations` — never the clock or any other I/O.
 */
export declare function renderReport(view: SessionView, recommendations: Recommendation[]): string;
