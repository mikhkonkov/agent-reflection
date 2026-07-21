/**
 * A MAIN AGENT event has no `agentId`, or an `agentId` equal to its own
 * `sessionId`. Anything else is attributed to a subagent.
 */
export function isMainAgentEvent(event) {
    return event.agentId === undefined || event.agentId === event.sessionId;
}
/** A tool call event is a completed (successful or failed) tool invocation. */
export function isToolCallEvent(event) {
    return event.eventName === "post_tool_use" || event.eventName === "post_tool_use_failure";
}
/** A failure is a `post_tool_use_failure` event, or any event with success === false. */
export function isFailureEvent(event) {
    return event.eventName === "post_tool_use_failure" || event.success === false;
}
/** Missing classifications default to "other" for aggregate counting purposes. */
export function effectiveClassification(event) {
    return event.toolClassification ?? "other";
}
export function emptyClassificationCounts() {
    return {
        discovery: 0,
        modification: 0,
        execution: 0,
        external_research: 0,
        delegation: 0,
        other: 0,
    };
}
function finalizeSegment(acc, endIndex) {
    return {
        startIndex: acc.startIndex,
        endIndex,
        length: endIndex - acc.startIndex + 1,
        toolNames: acc.toolNames,
        inputSize: acc.inputSize,
        outputSize: acc.outputSize,
        pathCount: acc.pathCount,
    };
}
/** Scan main-agent tool-call events (already in order) for discovery-only runs. */
function computeDiscoverySegments(mainToolCallEvents) {
    const segments = [];
    let current;
    for (const [idx, event] of mainToolCallEvents.entries()) {
        if (effectiveClassification(event) === "discovery") {
            const acc = current ?? {
                startIndex: idx,
                toolNames: [],
                inputSize: 0,
                outputSize: 0,
                pathCount: 0,
            };
            if (event.toolName)
                acc.toolNames.push(event.toolName);
            acc.inputSize += event.inputSize ?? 0;
            acc.outputSize += event.outputSize ?? 0;
            acc.pathCount += event.pathCount ?? 0;
            current = acc;
        }
        else if (current) {
            segments.push(finalizeSegment(current, idx - 1));
            current = undefined;
        }
    }
    if (current) {
        segments.push(finalizeSegment(current, mainToolCallEvents.length - 1));
    }
    return segments;
}
function computeSubagentMetrics(subagents) {
    return subagents.map((subagent) => ({
        id: subagent.id,
        agentType: subagent.agentType,
        model: subagent.model,
        startedAt: subagent.startedAt,
        endedAt: subagent.endedAt,
        durationMs: subagent.endedAt !== undefined
            ? new Date(subagent.endedAt).getTime() - new Date(subagent.startedAt).getTime()
            : undefined,
        toolCallCount: subagent.toolCallCount,
        failureCount: subagent.failureCount,
    }));
}
function computeSubagentTypes(subagents) {
    const types = new Set();
    for (const subagent of subagents) {
        if (subagent.agentType !== undefined)
            types.add(subagent.agentType);
    }
    return Array.from(types).sort();
}
/**
 * Deterministically aggregate a session's normalized events (and subagent
 * records) into the SessionMetrics view every rule consumes.
 */
export function aggregate(input) {
    const { session, events, subagents, now } = input;
    let promptCount = 0;
    let estimatedInputBytes = 0;
    let estimatedOutputBytes = 0;
    let manualCompactions = 0;
    let autoCompactions = 0;
    let totalCompactions = 0;
    const mainToolCallEvents = [];
    const mainClassificationCounts = emptyClassificationCounts();
    const failures = [];
    events.forEach((event, index) => {
        if (event.inputSize !== undefined)
            estimatedInputBytes += event.inputSize;
        if (event.outputSize !== undefined)
            estimatedOutputBytes += event.outputSize;
        if (event.eventName === "user_prompt") {
            promptCount += 1;
        }
        if (event.eventName === "pre_compact") {
            totalCompactions += 1;
            if (event.compactionTrigger === "manual")
                manualCompactions += 1;
            else if (event.compactionTrigger === "auto")
                autoCompactions += 1;
        }
        if (!isMainAgentEvent(event) || !isToolCallEvent(event))
            return;
        mainToolCallEvents.push(event);
        const classification = effectiveClassification(event);
        mainClassificationCounts[classification] += 1;
        if (isFailureEvent(event)) {
            failures.push({
                index,
                toolName: event.toolName,
                classification: event.toolClassification,
                errorCategory: event.errorCategory ?? "unknown",
                relativePaths: event.relativePaths ?? [],
                occurredAt: event.occurredAt,
            });
        }
    });
    const discoverySegments = computeDiscoverySegments(mainToolCallEvents);
    const endBound = session.endedAt ?? now;
    const durationMs = endBound !== undefined
        ? new Date(endBound).getTime() - new Date(session.startedAt).getTime()
        : undefined;
    return {
        sessionId: session.id,
        mainModel: session.mainModel,
        promptCount,
        estimatedTurns: promptCount + mainToolCallEvents.length,
        mainToolCallCount: mainToolCallEvents.length,
        mainFailureCount: failures.length,
        mainClassificationCounts,
        failures,
        discoverySegments,
        manualCompactions,
        autoCompactions,
        totalCompactions,
        estimatedOutputBytes,
        estimatedInputBytes,
        subagents: computeSubagentMetrics(subagents),
        subagentTypes: computeSubagentTypes(subagents),
        durationMs,
    };
}
//# sourceMappingURL=session-aggregator.js.map