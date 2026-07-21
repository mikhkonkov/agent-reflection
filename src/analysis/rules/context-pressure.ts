import type { Recommendation, RecommendationSeverity } from "../../domain/recommendation.js";
import type { Rule, RuleContext } from "../recommendation-types.js";
import { clampConfidence } from "../recommendation-factory.js";

const RULE_ID = "context-pressure";

export const contextPressureRule: Rule = {
  id: RULE_ID,
  evaluate(ctx: RuleContext): Recommendation | null {
    const { metrics, config } = ctx;
    const byteThreshold = config.thresholds.contextOutputBytes;

    const hasAuto = metrics.autoCompactions >= 1;
    const hasManyTotal = metrics.totalCompactions >= 2;
    const hasBytePressure = metrics.estimatedOutputBytes > byteThreshold;

    if (!hasAuto && !hasManyTotal && !hasBytePressure) return null;

    const severity: RecommendationSeverity = hasAuto ? "high" : "warning";

    let confidence = 0.5;
    if (hasAuto) confidence += 0.2 + Math.min(0.15, 0.05 * (metrics.autoCompactions - 1));
    if (hasManyTotal) confidence += 0.1 + Math.min(0.1, 0.02 * (metrics.totalCompactions - 2));
    if (hasBytePressure) {
      confidence += Math.min(0.15, 0.15 * (metrics.estimatedOutputBytes / byteThreshold - 1));
    }

    return {
      ruleId: RULE_ID,
      severity,
      confidence: clampConfidence(confidence),
      title: "Context Pressure Signals",
      rationale: "The session shows context-pressure signals.",
      suggestedAction:
        "Move broad searches, large logs, and external research to isolated subagents, and return only short structured summaries to the main agent.",
      evidence: {
        autoCompactions: metrics.autoCompactions,
        totalCompactions: metrics.totalCompactions,
        estimatedOutputBytes: metrics.estimatedOutputBytes,
        threshold: byteThreshold,
      },
    };
  },
};
