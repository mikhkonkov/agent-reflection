import { describe, it, expect, beforeEach } from "vitest";
import { aggregate } from "../../src/analysis/session-aggregator.js";
import {
  makeSession,
  makeSubagent,
  toolCall,
  toolFailure,
  prompt,
  compaction,
  resetSeq,
} from "../helpers/factories.js";

beforeEach(resetSeq);

describe("aggregate", () => {
  it("counts prompts, tool calls, failures and classifications for the main agent", () => {
    const events = [
      prompt(),
      toolCall("Read", "discovery"),
      toolCall("Grep", "discovery"),
      toolCall("Edit", "modification"),
      toolFailure("Bash", "execution", "test_failure"),
    ];
    const m = aggregate({ session: makeSession(), events, subagents: [] });
    expect(m.promptCount).toBe(1);
    expect(m.mainToolCallCount).toBe(4);
    expect(m.mainFailureCount).toBe(1);
    expect(m.mainClassificationCounts.discovery).toBe(2);
    expect(m.mainClassificationCounts.modification).toBe(1);
    expect(m.mainClassificationCounts.execution).toBe(1);
    // estimatedTurns = promptCount + mainToolCallCount
    expect(m.estimatedTurns).toBe(5);
  });

  it("excludes subagent events from main-agent counts", () => {
    const events = [
      toolCall("Read", "discovery"),
      toolCall("Read", "discovery", { agentId: "agent-1" }),
    ];
    const m = aggregate({ session: makeSession(), events, subagents: [] });
    expect(m.mainToolCallCount).toBe(1);
  });

  it("detects a contiguous discovery segment broken by a modification", () => {
    const events = [
      toolCall("Read", "discovery"),
      toolCall("Read", "discovery"),
      toolCall("Grep", "discovery"),
      toolCall("Edit", "modification"),
      toolCall("Read", "discovery"),
    ];
    const m = aggregate({ session: makeSession(), events, subagents: [] });
    const lengths = m.discoverySegments.map((s) => s.length).sort((a, b) => b - a);
    expect(lengths[0]).toBe(3);
  });

  it("counts compactions by trigger", () => {
    const events = [compaction("auto"), compaction("manual"), compaction("unknown")];
    const m = aggregate({ session: makeSession(), events, subagents: [] });
    expect(m.autoCompactions).toBe(1);
    expect(m.manualCompactions).toBe(1);
    expect(m.totalCompactions).toBe(3);
  });

  it("sums observed input/output bytes across all events", () => {
    const events = [
      toolCall("Read", "discovery", { inputSize: 10, outputSize: 100 }),
      toolCall("Read", "discovery", { inputSize: 5, outputSize: 50 }),
    ];
    const m = aggregate({ session: makeSession(), events, subagents: [] });
    expect(m.estimatedOutputBytes).toBe(150);
    expect(m.estimatedInputBytes).toBe(15);
  });

  it("rolls up subagents and distinct types", () => {
    const subs = [
      makeSubagent({ id: "a1", agentType: "explore-cheap" }),
      makeSubagent({ id: "a2", agentType: "architect-escalation" }),
    ];
    const m = aggregate({ session: makeSession(), events: [], subagents: subs });
    expect(m.subagents).toHaveLength(2);
    expect(m.subagentTypes).toContain("explore-cheap");
    expect(m.subagentTypes).toContain("architect-escalation");
  });
});
