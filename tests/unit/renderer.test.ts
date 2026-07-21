import { describe, it, expect, beforeEach } from "vitest";
import { renderReport, humanDuration, humanBytes } from "../../src/analysis/report-renderer.js";
import { aggregate } from "../../src/analysis/session-aggregator.js";
import type { SessionView } from "../../src/domain/metrics.js";
import type { Recommendation } from "../../src/domain/recommendation.js";
import {
  makeSession,
  makeSubagent,
  toolCall,
  prompt,
  resetSeq,
} from "../helpers/factories.js";

beforeEach(resetSeq);

function view(options: { withSubagent?: boolean } = {}): SessionView {
  const session = makeSession();
  const events = [prompt(), toolCall("Read", "discovery"), toolCall("Edit", "modification")];
  const subagentRecords = options.withSubagent ? [makeSubagent()] : [];
  const metrics = aggregate({ session, events, subagents: subagentRecords });
  return { session, metrics, subagentRecords };
}

const sampleRec: Recommendation = {
  ruleId: "context-pressure",
  severity: "high",
  confidence: 0.87,
  title: "Context Pressure Signals",
  rationale: "The session shows context-pressure signals.",
  suggestedAction: "Move broad searches to isolated subagents.",
  evidence: { autoCompactions: 1, totalCompactions: 2 },
};

describe("renderReport", () => {
  it("renders the fixed report skeleton", () => {
    const md = renderReport(view(), []);
    expect(md).toContain("# Agent Auditor Report");
    expect(md).toContain("## Session");
    expect(md).toContain("## Activity");
    expect(md).toContain("## Subagents");
    expect(md).toContain("## Suggested Routing for Similar Work");
    expect(md).toContain("## Privacy");
  });

  it("is deterministic for identical input", () => {
    expect(renderReport(view(), [sampleRec])).toBe(renderReport(view(), [sampleRec]));
  });

  it("shows the no-subagents fallback line", () => {
    expect(renderReport(view(), [])).toContain("No subagents were launched.");
  });

  it("renders a subagent table row when subagents ran", () => {
    const md = renderReport(view({ withSubagent: true }), []);
    expect(md).not.toContain("No subagents were launched.");
    expect(md).toContain("explore-cheap");
  });

  it("shows the empty-recommendations fallback", () => {
    expect(renderReport(view(), [])).toContain(
      "No material workflow inefficiencies were detected by the configured rules.",
    );
  });

  it("renders a recommendation with severity, confidence and evidence", () => {
    const md = renderReport(view(), [sampleRec]);
    expect(md).toContain("Context Pressure Signals");
    expect(md).toContain("0.87");
    expect(md).toContain("autoCompactions");
  });
});

describe("humanDuration", () => {
  it("formats minutes and seconds", () => {
    expect(humanDuration(18 * 60_000 + 22_000)).toContain("18m");
  });
  it("returns a placeholder for undefined", () => {
    expect(humanDuration(undefined)).toMatch(/unknown|-/);
  });
});

describe("humanBytes", () => {
  it("formats bytes into a human-readable string", () => {
    expect(humanBytes(1024)).toMatch(/KB|1024|1\.0/);
    expect(humanBytes(0)).toBeTruthy();
  });
});
