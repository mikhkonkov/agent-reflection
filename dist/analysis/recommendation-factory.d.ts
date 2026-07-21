import type { Recommendation, RecommendationSeverity } from "../domain/recommendation.js";
/** Clamp a value into [min, max]. NaN inputs fall back to `min`. */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Rule confidence is intentionally never allowed to reach full certainty:
 * capped at 0.95 so recommendations never read as a guaranteed outcome.
 */
export declare function clampConfidence(value: number): number;
/** Clamp a value into the full [0, 1] range, for callers that need it. */
export declare function bounded(value: number): number;
export interface RecommendationInput {
    ruleId: string;
    severity: RecommendationSeverity;
    confidence: number;
    title: string;
    rationale: string;
    suggestedAction: string;
    evidence: Record<string, unknown>;
}
/** Build a Recommendation with its confidence clamped to the approved range. */
export declare function makeRecommendation(input: RecommendationInput): Recommendation;
