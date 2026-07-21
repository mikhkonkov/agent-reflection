import type { Recommendation } from "../../domain/recommendation.js";
import type { Rule, RuleContext } from "../recommendation-types.js";
import { clampConfidence } from "../recommendation-factory.js";

const RULE_ID = "excessive-main-context-exploration";

export const excessiveMainContextExplorationRule: Rule = {
  id: RULE_ID,
  evaluate(ctx: RuleContext): Recommendation | null {
    const { metrics, config } = ctx;
    const ratioThreshold = config.thresholds.explorationCallRatio;
    const minCalls = config.thresholds.excessiveExplorationCalls;

    const discoveryCalls = metrics.mainClassificationCounts.discovery;
    const totalMainToolCalls = metrics.mainToolCallCount;
    const modificationCalls = metrics.mainClassificationCounts.modification;

    if (discoveryCalls < minCalls) return null;
    if (totalMainToolCalls === 0) return null;

    const ratio = discoveryCalls / totalMainToolCalls;
    if (ratio < ratioThreshold) return null;
    if (metrics.subagentTypes.includes("explore-cheap")) return null;
    if (modificationCalls >= 4) return null;

    const ratioTerm =
      ratioThreshold >= 1 ? 0 : (0.3 * (ratio - ratioThreshold)) / (1 - ratioThreshold);
    const countTerm = 0.15 * Math.min(1, (discoveryCalls - minCalls) / minCalls);
    const confidence = clampConfidence(0.5 + ratioTerm + countTerm);

    return {
      ruleId: RULE_ID,
      severity: "warning",
      confidence,
      title: "Excessive Main-Context Exploration",
      rationale:
        "Most of the session consisted of read-only repository exploration in the main context.",
      suggestedAction:
        "For similar work, delegate file discovery and code-path tracing to `explore-cheap` and request a concise evidence-based summary.",
      evidence: {
        discoveryCalls,
        totalMainToolCalls,
        ratio: Math.round(ratio * 100) / 100,
        modificationCalls,
      },
    };
  },
};
