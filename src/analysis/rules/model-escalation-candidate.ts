import type { Recommendation, RecommendationSeverity } from "../../domain/recommendation.js";
import type { Rule, RuleContext } from "../recommendation-types.js";
import { clampConfidence } from "../recommendation-factory.js";

const RULE_ID = "model-escalation-candidate";

export const modelEscalationCandidateRule: Rule = {
  id: RULE_ID,
  evaluate(ctx: RuleContext): Recommendation | null {
    const { metrics, session, config } = ctx;

    if (metrics.estimatedTurns < config.thresholds.escalationMinTurns) return null;

    const executionFailures = metrics.failures.filter(
      (f) => f.classification === "execution",
    ).length;
    if (executionFailures < config.thresholds.repeatedFailureCount) return null;

    const modificationCount = metrics.mainClassificationCounts.modification;
    if (modificationCount < 4) return null;

    if (metrics.subagentTypes.includes("architect-escalation")) return null;

    const outcome = session.userOutcome;
    if (outcome === "accepted") return null;

    const severity: RecommendationSeverity =
      outcome === "failed" || outcome === "rework" ? "high" : "warning";

    const outcomeBonus = outcome === "failed" ? 0.25 : outcome === "rework" ? 0.15 : 0;
    const turnsOverage = metrics.estimatedTurns - config.thresholds.escalationMinTurns;
    const failureOverage = executionFailures - config.thresholds.repeatedFailureCount;
    const confidence = clampConfidence(
      0.45 + outcomeBonus + 0.02 * turnsOverage + 0.05 * failureOverage,
    );

    return {
      ruleId: RULE_ID,
      severity,
      confidence,
      title: "Model Escalation Candidate",
      rationale:
        "The task has signals of an unproductive implementation loop or unresolved ambiguity.",
      suggestedAction:
        "Consider launching `architect-escalation` with a compact handoff: goal, current diff, failing command, error category, relevant files, and attempted hypotheses.",
      evidence: {
        estimatedTurns: metrics.estimatedTurns,
        executionFailures,
        modificationCount,
        userOutcome: outcome ?? "unlabelled",
      },
    };
  },
};
