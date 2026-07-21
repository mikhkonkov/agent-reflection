import { describe, it, expect } from "vitest";
import { sortRecommendations } from "../../src/analysis/rule-engine.js";
import type { Recommendation } from "../../src/domain/recommendation.js";

function rec(
  ruleId: string,
  severity: Recommendation["severity"],
  confidence: number,
): Recommendation {
  return {
    ruleId,
    severity,
    confidence,
    title: ruleId,
    rationale: "",
    suggestedAction: "",
    evidence: {},
  };
}

describe("sortRecommendations", () => {
  it("orders by severity (high > warning > info)", () => {
    const sorted = sortRecommendations([
      rec("a", "info", 0.9),
      rec("b", "high", 0.1),
      rec("c", "warning", 0.5),
    ]);
    expect(sorted.map((r) => r.severity)).toEqual(["high", "warning", "info"]);
  });

  it("orders by confidence descending within a severity", () => {
    const sorted = sortRecommendations([
      rec("a", "warning", 0.3),
      rec("b", "warning", 0.8),
      rec("c", "warning", 0.5),
    ]);
    expect(sorted.map((r) => r.confidence)).toEqual([0.8, 0.5, 0.3]);
  });

  it("breaks confidence ties by ruleId ascending", () => {
    const sorted = sortRecommendations([
      rec("zebra", "info", 0.5),
      rec("alpha", "info", 0.5),
      rec("mango", "info", 0.5),
    ]);
    expect(sorted.map((r) => r.ruleId)).toEqual(["alpha", "mango", "zebra"]);
  });

  it("is deterministic and does not mutate the input", () => {
    const input = [rec("b", "info", 0.5), rec("a", "high", 0.5)];
    const copy = [...input];
    sortRecommendations(input);
    expect(input).toEqual(copy);
  });
});
