import type { NormalizedEvent, ToolClassification } from "../domain/event.js";
import type { ClassificationCounts, SessionMetrics } from "../domain/metrics.js";
import type { SessionRecord } from "../domain/session.js";
import type { SubagentRecord } from "../domain/subagent.js";
/**
 * A MAIN AGENT event has no `agentId`, or an `agentId` equal to its own
 * `sessionId`. Anything else is attributed to a subagent.
 */
export declare function isMainAgentEvent(event: NormalizedEvent): boolean;
/** A tool call event is a completed (successful or failed) tool invocation. */
export declare function isToolCallEvent(event: NormalizedEvent): boolean;
/** A failure is a `post_tool_use_failure` event, or any event with success === false. */
export declare function isFailureEvent(event: NormalizedEvent): boolean;
/** Missing classifications default to "other" for aggregate counting purposes. */
export declare function effectiveClassification(event: NormalizedEvent): ToolClassification;
export declare function emptyClassificationCounts(): ClassificationCounts;
/**
 * Deterministically aggregate a session's normalized events (and subagent
 * records) into the SessionMetrics view every rule consumes.
 */
export declare function aggregate(input: {
    session: SessionRecord;
    events: NormalizedEvent[];
    subagents: SubagentRecord[];
}): SessionMetrics;
