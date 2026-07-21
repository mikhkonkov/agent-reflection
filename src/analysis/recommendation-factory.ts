import type { Recommendation, RecommendationSeverity } from "../domain/recommendation.js";

/** Clamp a value into [min, max]. NaN inputs fall back to `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Rule confidence is intentionally never allowed to reach full certainty:
 * capped at 0.95 so recommendations never read as a guaranteed outcome.
 */
export function clampConfidence(value: number): number {
  return clamp(value, 0, 0.95);
}

/** Clamp a value into the full [0, 1] range, for callers that need it. */
export function bounded(value: number): number {
  return clamp(value, 0, 1);
}

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
export function makeRecommendation(input: RecommendationInput): Recommendation {
  return {
    ...input,
    confidence: clampConfidence(input.confidence),
  };
}
