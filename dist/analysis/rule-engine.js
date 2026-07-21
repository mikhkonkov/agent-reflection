import { cheapSubagentCandidateRule } from "./rules/cheap-subagent-candidate.js";
import { contextPressureRule } from "./rules/context-pressure.js";
import { excessiveMainContextExplorationRule } from "./rules/excessive-main-context-exploration.js";
import { modelEscalationCandidateRule } from "./rules/model-escalation-candidate.js";
import { repeatedExecutionFailureRule } from "./rules/repeated-execution-failure.js";
export const ALL_RULES = [
    excessiveMainContextExplorationRule,
    repeatedExecutionFailureRule,
    modelEscalationCandidateRule,
    contextPressureRule,
    cheapSubagentCandidateRule,
];
const SEVERITY_RANK = {
    high: 0,
    warning: 1,
    info: 2,
};
/** Sort by severity (high first), then confidence descending, then ruleId ascending. */
export function sortRecommendations(recommendations) {
    return [...recommendations].sort((a, b) => {
        const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (severityDiff !== 0)
            return severityDiff;
        if (a.confidence !== b.confidence)
            return b.confidence - a.confidence;
        return a.ruleId.localeCompare(b.ruleId);
    });
}
/** Run every rule against the context and return the sorted, non-null recommendations. */
export function runRules(ctx) {
    const results = [];
    for (const rule of ALL_RULES) {
        const recommendation = rule.evaluate(ctx);
        if (recommendation)
            results.push(recommendation);
    }
    return sortRecommendations(results);
}
//# sourceMappingURL=rule-engine.js.map