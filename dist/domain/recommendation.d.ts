export type RecommendationSeverity = "info" | "warning" | "high";
/**
 * A single evidence-based recommendation produced by the rule engine.
 * Wording must never claim certainty about a counterfactual model outcome.
 */
export interface Recommendation {
    ruleId: string;
    severity: RecommendationSeverity;
    /** Bounded [0, 1]. */
    confidence: number;
    title: string;
    /**
     * What happened, in concrete terms and past tense. Should name the files,
     * counts, or commands involved rather than describe the rule abstractly —
     * this is the line a user reads to recognize their own session.
     */
    rationale: string;
    /** The single imperative step to take, phrased so it can be acted on as-is. */
    suggestedAction: string;
    /** Optional copy-pasteable command backing `suggestedAction`. */
    command?: string;
    evidence: Record<string, unknown>;
}
/** A persisted recommendation row (mirrors the `recommendations` table). */
export interface RecommendationRecord extends Recommendation {
    id: number;
    sessionId: string;
    createdAt: string;
}
