import type { Recommendation } from "../domain/recommendation.js";
import type { Rule, RuleContext } from "./recommendation-types.js";
export declare const ALL_RULES: Rule[];
/** Sort by severity (high first), then confidence descending, then ruleId ascending. */
export declare function sortRecommendations(recommendations: Recommendation[]): Recommendation[];
/** Run every rule against the context and return the sorted, non-null recommendations. */
export declare function runRules(ctx: RuleContext): Recommendation[];
