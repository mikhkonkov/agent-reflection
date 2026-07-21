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
    rationale: string;
    suggestedAction: string;
    evidence: Record<string, unknown>;
}
/** A persisted recommendation row (mirrors the `recommendations` table). */
export interface RecommendationRecord extends Recommendation {
    id: number;
    sessionId: string;
    createdAt: string;
}
