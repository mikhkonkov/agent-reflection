import type { ErrorCategory } from "../../domain/event.js";
import type { Recommendation } from "../../domain/recommendation.js";
import type { Rule, RuleContext } from "../recommendation-types.js";
import { clampConfidence } from "../recommendation-factory.js";
import { isMainAgentEvent } from "../session-aggregator.js";

const RULE_ID = "repeated-execution-failure";

export const repeatedExecutionFailureRule: Rule = {
  id: RULE_ID,
  evaluate(ctx: RuleContext): Recommendation | null {
    const { metrics, events, config } = ctx;
    const threshold = config.thresholds.repeatedFailureCount;

    const executionFailures = metrics.failures.filter((f) => f.classification === "execution");
    if (executionFailures.length < threshold) return null;

    const first = executionFailures[0];
    const final = executionFailures[executionFailures.length - 1];
    if (!first || !final) return null;

    let modificationCountBetweenFailures = 0;
    for (let idx = first.index + 1; idx < final.index; idx += 1) {
      const event = events[idx];
      if (!event) continue;
      if (!isMainAgentEvent(event)) continue;
      if (event.toolClassification === "modification") modificationCountBetweenFailures += 1;
    }
    if (modificationCountBetweenFailures < 1) return null;

    const categoryCounts = new Map<ErrorCategory, number>();
    for (const failure of executionFailures) {
      categoryCounts.set(
        failure.errorCategory,
        (categoryCounts.get(failure.errorCategory) ?? 0) + 1,
      );
    }

    let dominantCategory: ErrorCategory | undefined;
    let dominantCount = 0;
    for (const failure of executionFailures) {
      const count = categoryCounts.get(failure.errorCategory) ?? 0;
      if (count > dominantCount) {
        dominantCount = count;
        dominantCategory = failure.errorCategory;
      }
    }
    if (!dominantCategory || dominantCount < 2) return null;

    const affectedRelativePaths = Array.from(
      new Set(executionFailures.flatMap((f) => f.relativePaths)),
    ).sort();

    const confidence = clampConfidence(
      0.5 + 0.1 * (executionFailures.length - threshold) + 0.1 * (dominantCount - 2),
    );

    return {
      ruleId: RULE_ID,
      severity: "warning",
      confidence,
      title: "Repeated Edit-Execution Failure Loop",
      rationale: "The session entered a repeated edit → execution failure loop.",
      suggestedAction:
        "After two similar failures, stop extending the same hypothesis and request an independent diagnosis before making further edits.",
      evidence: {
        failureCount: executionFailures.length,
        errorCategory: dominantCategory,
        modificationCountBetweenFailures,
        affectedRelativePaths,
      },
    };
  },
};
