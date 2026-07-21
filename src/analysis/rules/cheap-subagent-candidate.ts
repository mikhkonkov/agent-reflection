import type { Recommendation } from "../../domain/recommendation.js";
import type { Rule, RuleContext } from "../recommendation-types.js";
import { clampConfidence } from "../recommendation-factory.js";

const RULE_ID = "cheap-subagent-candidate";

export const cheapSubagentCandidateRule: Rule = {
  id: RULE_ID,
  evaluate(ctx: RuleContext): Recommendation | null {
    const { metrics, config } = ctx;
    const minCalls = config.thresholds.cheapCandidateMinCalls;

    const qualifying = metrics.discoverySegments.filter((seg) => seg.length >= minCalls);
    const firstQualifying = qualifying[0];
    if (!firstQualifying) return null;

    const isHaiku = (metrics.mainModel ?? "").toLowerCase().includes("haiku");
    if (isHaiku) return null;

    if (metrics.subagentTypes.includes("explore-cheap")) return null;

    let largest = firstQualifying;
    for (const seg of qualifying) {
      if (seg.length > largest.length) largest = seg;
    }

    const confidence = clampConfidence(0.4 + 0.05 * (largest.length - minCalls));

    return {
      ruleId: RULE_ID,
      severity: "info",
      confidence,
      title: "Cheap Subagent Candidate Segment",
      rationale: "A bounded read-only exploration segment was detected.",
      suggestedAction:
        "This is a candidate for `explore-cheap` / Haiku in a separate context window.",
      evidence: {
        segmentLength: largest.length,
        discoveryToolNames: largest.toolNames,
        estimatedInputSize: largest.inputSize,
        estimatedOutputSize: largest.outputSize,
        relativePathsCount: largest.pathCount,
      },
    };
  },
};
