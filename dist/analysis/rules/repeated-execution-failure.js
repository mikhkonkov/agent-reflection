import { clampConfidence } from "../recommendation-factory.js";
import { isMainAgentEvent } from "../session-aggregator.js";
import { describeErrorCategory, edits, formatFileList, times } from "../phrasing.js";
const RULE_ID = "repeated-execution-failure";
export const repeatedExecutionFailureRule = {
    id: RULE_ID,
    evaluate(ctx) {
        const { metrics, events, config } = ctx;
        const threshold = config.thresholds.repeatedFailureCount;
        const executionFailures = metrics.failures.filter((f) => f.classification === "execution");
        if (executionFailures.length < threshold)
            return null;
        const first = executionFailures[0];
        const final = executionFailures[executionFailures.length - 1];
        if (!first || !final)
            return null;
        let modificationCountBetweenFailures = 0;
        // Execution failures (a failing `pnpm test`, say) carry no file paths of
        // their own, so the files being churned are read off the modifications
        // sitting between the first and last failure — that is the actual loop.
        const modifiedPaths = [];
        for (let idx = first.index + 1; idx < final.index; idx += 1) {
            const event = events[idx];
            if (!event)
                continue;
            if (!isMainAgentEvent(event))
                continue;
            if (event.toolClassification === "modification") {
                modificationCountBetweenFailures += 1;
                modifiedPaths.push(...(event.relativePaths ?? []));
            }
        }
        if (modificationCountBetweenFailures < 1)
            return null;
        const categoryCounts = new Map();
        for (const failure of executionFailures) {
            categoryCounts.set(failure.errorCategory, (categoryCounts.get(failure.errorCategory) ?? 0) + 1);
        }
        let dominantCategory;
        let dominantCount = 0;
        for (const failure of executionFailures) {
            const count = categoryCounts.get(failure.errorCategory) ?? 0;
            if (count > dominantCount) {
                dominantCount = count;
                dominantCategory = failure.errorCategory;
            }
        }
        if (!dominantCategory || dominantCount < 2)
            return null;
        const affectedRelativePaths = Array.from(new Set([...executionFailures.flatMap((f) => f.relativePaths), ...modifiedPaths])).sort();
        const confidence = clampConfidence(0.5 + 0.1 * (executionFailures.length - threshold) + 0.1 * (dominantCount - 2));
        const fileList = formatFileList(affectedRelativePaths);
        const whereClause = fileList === undefined ? "" : ` in ${fileList}`;
        return {
            ruleId: RULE_ID,
            severity: "warning",
            confidence,
            title: "Repeated Edit-Execution Failure Loop",
            rationale: `A run command failed ${times(executionFailures.length)} on ${describeErrorCategory(dominantCategory)}, ` +
                `with ${edits(modificationCountBetweenFailures)}${whereClause} in between — each fix was followed by the same class of failure.`,
            suggestedAction: "Stop editing and get an independent diagnosis: hand off the goal, the failing command, its error output, and the hypotheses already tried to `architect-escalation`.",
            evidence: {
                failureCount: executionFailures.length,
                errorCategory: dominantCategory,
                modificationCountBetweenFailures,
                affectedRelativePaths,
            },
        };
    },
};
//# sourceMappingURL=repeated-execution-failure.js.map