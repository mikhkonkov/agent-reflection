import type {
  NormalizedEvent,
  EventName,
  ToolClassification,
  ErrorCategory,
} from "../../src/domain/event.js";
import type { SessionRecord, UserOutcome } from "../../src/domain/session.js";
import type { SubagentRecord } from "../../src/domain/subagent.js";
import type { RuleContext } from "../../src/analysis/recommendation-types.js";
import { aggregate } from "../../src/analysis/session-aggregator.js";
import { defaultConfig } from "../../src/config/defaults.js";
import type { AuditorConfig } from "../../src/config/config-schema.js";

const BASE_TIME = Date.parse("2026-07-21T14:00:00.000Z");

/** Deterministic ISO timestamp at BASE_TIME + `index` seconds. */
export function ts(index: number): string {
  return new Date(BASE_TIME + index * 1000).toISOString();
}

let seq = 0;
export function resetSeq(): void {
  seq = 0;
}

export function makeEvent(partial: Partial<NormalizedEvent> & { eventName: EventName }): NormalizedEvent {
  const index = seq++;
  return {
    sessionId: "sess-1",
    eventName: partial.eventName,
    occurredAt: partial.occurredAt ?? ts(index),
    metadata: partial.metadata ?? {},
    ...partial,
  };
}

/** A main-agent tool-call event (success). */
export function toolCall(
  toolName: string,
  classification: ToolClassification,
  overrides: Partial<NormalizedEvent> = {},
): NormalizedEvent {
  return makeEvent({
    eventName: "post_tool_use",
    toolName,
    toolClassification: classification,
    success: true,
    inputSize: 100,
    outputSize: 200,
    ...overrides,
  });
}

/** A main-agent tool-call failure event. */
export function toolFailure(
  toolName: string,
  classification: ToolClassification,
  errorCategory: ErrorCategory,
  overrides: Partial<NormalizedEvent> = {},
): NormalizedEvent {
  return makeEvent({
    eventName: "post_tool_use_failure",
    toolName,
    toolClassification: classification,
    success: false,
    errorCategory,
    inputSize: 100,
    outputSize: 200,
    ...overrides,
  });
}

export function prompt(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return makeEvent({ eventName: "user_prompt", inputSize: 50, ...overrides });
}

export function compaction(
  trigger: "manual" | "auto" | "unknown",
  overrides: Partial<NormalizedEvent> = {},
): NormalizedEvent {
  return makeEvent({ eventName: "pre_compact", compactionTrigger: trigger, ...overrides });
}

export function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess-1",
    repositoryHash: "hash-abc",
    repositoryName: "demo-repo",
    gitBranch: "main",
    startedAt: ts(0),
    endedAt: ts(1000),
    mainModel: "sonnet",
    source: "startup",
    promptCount: 0,
    toolCallCount: 0,
    toolFailureCount: 0,
    subagentCount: 0,
    compactCount: 0,
    status: "completed",
    createdAt: ts(0),
    ...overrides,
  };
}

export function makeSubagent(overrides: Partial<SubagentRecord> = {}): SubagentRecord {
  return {
    id: "agent-1",
    sessionId: "sess-1",
    agentType: "explore-cheap",
    model: "haiku",
    startedAt: ts(1),
    endedAt: ts(5),
    toolCallCount: 3,
    failureCount: 0,
    ...overrides,
  };
}

/** Build a RuleContext from events (+ optional session/subagents/config overrides). */
export function buildContext(
  events: NormalizedEvent[],
  options: {
    session?: Partial<SessionRecord>;
    subagents?: SubagentRecord[];
    config?: AuditorConfig;
    userOutcome?: UserOutcome;
  } = {},
): RuleContext {
  const session = makeSession({
    ...options.session,
    ...(options.userOutcome ? { userOutcome: options.userOutcome } : {}),
  });
  const subagents = options.subagents ?? [];
  const metrics = aggregate({ session, events, subagents });
  return { metrics, events, session, config: options.config ?? defaultConfig() };
}
