import { describe, it, expect } from "vitest";
import {
  clamp,
  clampConfidence,
  bounded,
  makeRecommendation,
} from "../../src/analysis/recommendation-factory.js";

describe("clamp", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it("falls back to min on NaN", () => {
    expect(clamp(Number.NaN, 2, 10)).toBe(2);
  });
});

describe("clampConfidence", () => {
  it("caps confidence at 0.95", () => {
    expect(clampConfidence(1)).toBe(0.95);
    expect(clampConfidence(0.5)).toBe(0.5);
    expect(clampConfidence(-1)).toBe(0);
  });
});

describe("bounded", () => {
  it("clamps into [0, 1]", () => {
    expect(bounded(2)).toBe(1);
    expect(bounded(-2)).toBe(0);
    expect(bounded(0.42)).toBe(0.42);
  });
});

describe("makeRecommendation", () => {
  it("builds a recommendation with confidence clamped", () => {
    const rec = makeRecommendation({
      ruleId: "r",
      severity: "info",
      confidence: 5,
      title: "t",
      rationale: "why",
      suggestedAction: "do",
      evidence: { a: 1 },
    });
    expect(rec.confidence).toBe(0.95);
    expect(rec.ruleId).toBe("r");
    expect(rec.evidence).toEqual({ a: 1 });
  });
});
