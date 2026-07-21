import type { SessionView } from "../domain/metrics.js";
import type { Recommendation } from "../domain/recommendation.js";
/** Format a millisecond duration as e.g. "18m 22s", or "unknown" when absent. */
export declare function humanDuration(ms?: number): string;
/** Format a byte count as e.g. "1.2 MB". */
export declare function humanBytes(n: number): string;
/** Format a token count as e.g. "3.9M", "104.2K", "156". */
export declare function humanTokens(n: number): string;
/**
 * Render the deterministic Markdown audit report for a session. Uses only
 * `view` and `recommendations` — never the clock or any other I/O.
 */
export declare function renderReport(view: SessionView, recommendations: Recommendation[]): string;
