import { describe, it, expect, beforeEach } from "vitest";
import { runRules } from "../../src/analysis/rule-engine.js";
import type { Recommendation } from "../../src/domain/recommendation.js";
import type { NormalizedEvent } from "../../src/domain/event.js";
import {
  buildContext,
  makeSubagent,
  toolCall,
  toolFailure,
  prompt,
  compaction,
  resetSeq,
} from "../helpers/factories.js";

beforeEach(resetSeq);

function byId(recs: Recommendation[], id: string): Recommendation | undefined {
  return recs.find((r) => r.ruleId === id);
}

function repeat(n: number, make: () => NormalizedEvent): NormalizedEvent[] {
  return Array.from({ length: n }, make);
}

describe("excessive-main-context-exploration", () => {
  const RULE = "excessive-main-context-exploration";

  it("fires on discovery-heavy sessions with few modifications and no explore-cheap", () => {
    const events = [
      ...repeat(16, () => toolCall("Read", "discovery")),
      toolCall("Edit", "modification"),
    ];
    const rec = byId(runRules(buildContext(events)), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("warning");
    expect(rec?.confidence).toBeLessThanOrEqual(0.95);
    expect(rec?.confidence).toBeGreaterThan(0.5);
  });

  it("does not fire when an explore-cheap subagent was used", () => {
    const events = repeat(16, () => toolCall("Read", "discovery"));
    const ctx = buildContext(events, {
      subagents: [makeSubagent({ agentType: "explore-cheap" })],
    });
    expect(byId(runRules(ctx), RULE)).toBeUndefined();
  });

  it("does not fire when modifications are 4 or more", () => {
    const events = [
      ...repeat(16, () => toolCall("Read", "discovery")),
      ...repeat(4, () => toolCall("Edit", "modification")),
    ];
    expect(byId(runRules(buildContext(events)), RULE)).toBeUndefined();
  });
});

describe("repeated-execution-failure", () => {
  const RULE = "repeated-execution-failure";

  it("fires on an edit -> execution failure loop with a shared category", () => {
    const events = [
      toolFailure("Bash", "execution", "test_failure"),
      toolCall("Edit", "modification"),
      toolFailure("Bash", "execution", "test_failure"),
      toolFailure("Bash", "execution", "command_non_zero_exit"),
    ];
    const rec = byId(runRules(buildContext(events)), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("warning");
    expect(rec?.evidence.errorCategory).toBe("test_failure");
  });

  it("does not fire without a modification between failures", () => {
    const events = repeat(3, () => toolFailure("Bash", "execution", "test_failure"));
    expect(byId(runRules(buildContext(events)), RULE)).toBeUndefined();
  });
});

describe("model-escalation-candidate", () => {
  const RULE = "model-escalation-candidate";

  function loopEvents(): NormalizedEvent[] {
    return [
      prompt(),
      prompt(),
      ...repeat(4, () => toolCall("Edit", "modification")),
      ...repeat(3, () => toolCall("Read", "discovery")),
      ...repeat(3, () => toolFailure("Bash", "execution", "test_failure")),
    ];
  }

  it("fires as warning when outcome is unlabelled", () => {
    const rec = byId(runRules(buildContext(loopEvents())), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("warning");
  });

  it("fires as high when outcome is failed", () => {
    const rec = byId(runRules(buildContext(loopEvents(), { userOutcome: "failed" })), RULE);
    expect(rec?.severity).toBe("high");
  });

  it("does not fire when architect-escalation was launched", () => {
    const ctx = buildContext(loopEvents(), {
      subagents: [makeSubagent({ agentType: "architect-escalation", model: "opus" })],
    });
    expect(byId(runRules(ctx), RULE)).toBeUndefined();
  });
});

describe("context-pressure", () => {
  const RULE = "context-pressure";

  it("fires as high when an auto compaction occurred", () => {
    const rec = byId(runRules(buildContext([compaction("auto")])), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("high");
  });

  it("fires as warning on two manual compactions", () => {
    const rec = byId(runRules(buildContext([compaction("manual"), compaction("manual")])), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("warning");
  });

  it("fires when observed output exceeds the threshold", () => {
    const big = toolCall("Read", "discovery", { outputSize: 600_000 });
    const rec = byId(runRules(buildContext([big])), RULE);
    expect(rec).toBeDefined();
  });
});

describe("cheap-subagent-candidate", () => {
  const RULE = "cheap-subagent-candidate";

  it("fires on a bounded discovery segment when the main model is not Haiku", () => {
    const events = repeat(6, () => toolCall("Read", "discovery"));
    const rec = byId(runRules(buildContext(events)), RULE);
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe("info");
    expect(rec?.evidence.segmentLength).toBeGreaterThanOrEqual(5);
  });

  it("does not fire when the main model is Haiku", () => {
    const events = repeat(6, () => toolCall("Read", "discovery"));
    const ctx = buildContext(events, { session: { mainModel: "claude-haiku-4-5" } });
    expect(byId(runRules(ctx), RULE)).toBeUndefined();
  });

  it("does not fire when an explore-cheap subagent already ran", () => {
    const events = repeat(6, () => toolCall("Read", "discovery"));
    const ctx = buildContext(events, {
      subagents: [makeSubagent({ agentType: "explore-cheap" })],
    });
    expect(byId(runRules(ctx), RULE)).toBeUndefined();
  });
});
