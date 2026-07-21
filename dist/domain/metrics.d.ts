import type { ErrorCategory, ToolClassification } from "./event.js";
import type { SubagentRecord } from "./subagent.js";
import type { SessionRecord } from "./session.js";
/** Tool-call counts broken down by classification. */
export type ClassificationCounts = Record<ToolClassification, number>;
/** A single observed tool failure, in event order. */
export interface FailureObservation {
    index: number;
    toolName?: string;
    classification?: ToolClassification;
    errorCategory: ErrorCategory;
    relativePaths: string[];
    occurredAt: string;
}
/**
 * A contiguous run of discovery-only tool calls in the main agent, with no
 * modification or execution calls interleaved. Used by the cheap-subagent rule.
 */
export interface DiscoverySegment {
    startIndex: number;
    endIndex: number;
    length: number;
    toolNames: string[];
    inputSize: number;
    outputSize: number;
    pathCount: number;
}
/** Rolled-up metrics for a single subagent. */
export interface SubagentMetrics {
    id: string;
    agentType?: string;
    model?: string;
    startedAt: string;
    endedAt?: string;
    durationMs?: number;
    toolCallCount: number;
    failureCount: number;
}
/**
 * The deterministic aggregate view of a session that every rule consumes.
 * "main*" fields count only main-agent activity (events without an agentId);
 * subagent activity lives in `subagents`.
 *
 * estimatedTurns is a pinned heuristic:  promptCount + mainToolCallCount.
 */
export interface SessionMetrics {
    sessionId: string;
    mainModel?: string;
    promptCount: number;
    estimatedTurns: number;
    mainToolCallCount: number;
    mainFailureCount: number;
    mainClassificationCounts: ClassificationCounts;
    /** All failures (main agent) in event order. */
    failures: FailureObservation[];
    /** Contiguous discovery-only segments in the main agent. */
    discoverySegments: DiscoverySegment[];
    manualCompactions: number;
    autoCompactions: number;
    totalCompactions: number;
    /** Sum of observed output sizes across all events. */
    estimatedOutputBytes: number;
    /** Sum of observed input sizes across all events. */
    estimatedInputBytes: number;
    subagents: SubagentMetrics[];
    /** Distinct subagent types launched, e.g. ["explore-cheap"]. */
    subagentTypes: string[];
    durationMs?: number;
}
/** Everything the report renderer needs: the session row plus its metrics. */
export interface SessionView {
    session: SessionRecord;
    metrics: SessionMetrics;
    subagentRecords: SubagentRecord[];
}
