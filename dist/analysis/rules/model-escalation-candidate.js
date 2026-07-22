import { clampConfidence } from "../recommendation-factory.js";
const RULE_ID = "model-escalation-candidate";
export const modelEscalationCandidateRule = {
    id: RULE_ID,
    evaluate(ctx) {
        const { metrics, config } = ctx;
        if (metrics.estimatedTurns < config.thresholds.escalationMinTurns)
            return null;
        const executionFailures = metrics.failures.filter((f) => f.classification === "execution").length;
        if (executionFailures < config.thresholds.repeatedFailureCount)
            return null;
        const modificationCount = metrics.mainClassificationCounts.modification;
        if (modificationCount < 4)
            return null;
        if (metrics.subagentTypes.includes("architect-escalation"))
            return null;
        const severity = "warning";
        const turnsOverage = metrics.estimatedTurns - config.thresholds.escalationMinTurns;
        const failureOverage = executionFailures - config.thresholds.repeatedFailureCount;
        const confidence = clampConfidence(0.45 + 0.02 * turnsOverage + 0.05 * failureOverage);
        return {
            ruleId: RULE_ID,
            severity,
            confidence,
            title: "Model Escalation Candidate",
            rationale: `The session ran ~${metrics.estimatedTurns} turns with ${modificationCount} edits and ` +
                `${executionFailures} failed runs — the shape of a loop that is not converging on its own.`,
            suggestedAction: "Hand the work to `architect-escalation` with a compact handoff: goal, current diff, failing command, error category, relevant files, and hypotheses already tried.",
            evidence: {
                estimatedTurns: metrics.estimatedTurns,
                executionFailures,
                modificationCount,
            },
        };
    },
};
//# sourceMappingURL=model-escalation-candidate.js.map