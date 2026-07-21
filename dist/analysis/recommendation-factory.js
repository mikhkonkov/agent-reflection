/** Clamp a value into [min, max]. NaN inputs fall back to `min`. */
export function clamp(value, min, max) {
    if (Number.isNaN(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
/**
 * Rule confidence is intentionally never allowed to reach full certainty:
 * capped at 0.95 so recommendations never read as a guaranteed outcome.
 */
export function clampConfidence(value) {
    return clamp(value, 0, 0.95);
}
/** Clamp a value into the full [0, 1] range, for callers that need it. */
export function bounded(value) {
    return clamp(value, 0, 1);
}
/** Build a Recommendation with its confidence clamped to the approved range. */
export function makeRecommendation(input) {
    return {
        ...input,
        confidence: clampConfidence(input.confidence),
    };
}
//# sourceMappingURL=recommendation-factory.js.map