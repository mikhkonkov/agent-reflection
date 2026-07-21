import type { DatabaseHandle } from "../storage/database.js";
import type { AuditorConfig } from "../config/config-schema.js";
import type { SessionView } from "../domain/metrics.js";
import type { Recommendation } from "../domain/recommendation.js";
export interface FinalizeParams {
    db: DatabaseHandle;
    sessionId: string;
    config: AuditorConfig;
    reportsDir: string;
    /** ISO timestamp used only for recommendation bookkeeping (never rendered). */
    createdAt: string;
}
export interface FinalizeResult {
    reportPath: string;
    markdown: string;
    recommendations: Recommendation[];
    view: SessionView;
}
/**
 * Load a session's telemetry, run analysis, persist recommendations, render the
 * Markdown report, and (when configured) write it to disk. Idempotent: existing
 * recommendations for the session are replaced, so it is safe to re-run after a
 * label change. Returns null when the session does not exist.
 *
 * The report file name uses the session's start DATE (derived from stored data),
 * keeping output deterministic and independent of wall-clock time.
 */
export declare function finalizeSession(params: FinalizeParams): FinalizeResult | null;
