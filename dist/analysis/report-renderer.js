const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
/** Format a millisecond duration as e.g. "18m 22s", or "unknown" when absent. */
export function humanDuration(ms) {
    if (ms === undefined)
        return "unknown";
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0)
        parts.push(`${hours}h`);
    if (hours > 0 || minutes > 0)
        parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
}
/** Format a byte count as e.g. "1.2 MB". */
export function humanBytes(n) {
    if (!Number.isFinite(n) || n <= 0)
        return "0 B";
    let value = n;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    const formatted = unitIndex === 0 ? `${Math.round(value)}` : value.toFixed(1);
    return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}
function severityLabel(severity) {
    switch (severity) {
        case "high":
            return "High";
        case "warning":
            return "Warning";
        case "info":
            return "Info";
    }
}
function stringifyEvidenceValue(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (value === null || value === undefined)
        return "none";
    if (Array.isArray(value))
        return value.length === 0 ? "[]" : JSON.stringify(value);
    return JSON.stringify(value);
}
function renderEvidence(evidence) {
    const entries = Object.entries(evidence);
    if (entries.length === 0)
        return ["- (none)"];
    return entries.map(([key, value]) => `- \`${key}\`: \`${stringifyEvidenceValue(value)}\``);
}
function renderRecommendation(rec) {
    return [
        `### \`${severityLabel(rec.severity)} — ${rec.title}\``,
        "",
        `**Confidence:** \`${rec.confidence.toFixed(2)}\``,
        "",
        rec.rationale,
        "",
        `**Suggested action:** ${rec.suggestedAction}`,
        "",
        "**Evidence:**",
        "",
        ...renderEvidence(rec.evidence),
    ];
}
/**
 * Render the deterministic Markdown audit report for a session. Uses only
 * `view` and `recommendations` — never the clock or any other I/O.
 */
export function renderReport(view, recommendations) {
    const { session, metrics } = view;
    const lines = [];
    lines.push("# Agent Auditor Report", "");
    lines.push("## Session", "");
    lines.push(`- Session ID: \`${session.id}\``);
    lines.push(`- Repository: \`${session.repositoryName}\``);
    lines.push(`- Branch: \`${session.gitBranch ?? "unknown"}\``);
    lines.push(`- Started: \`${session.startedAt}\``);
    lines.push(`- Duration: \`${humanDuration(metrics.durationMs)}\``);
    lines.push(`- Main model: \`${metrics.mainModel ?? "unknown"}\``);
    lines.push(`- Subagents: \`${metrics.subagents.length}\``);
    lines.push(`- Outcome: \`${session.userOutcome ?? "not labelled"}\``);
    lines.push("");
    lines.push("## Activity", "");
    lines.push("| Metric | Value |");
    lines.push("|---|---:|");
    lines.push(`| User prompts | \`${metrics.promptCount}\` |`);
    lines.push(`| Estimated turns | \`${metrics.estimatedTurns}\` |`);
    lines.push(`| Tool calls | \`${metrics.mainToolCallCount}\` |`);
    lines.push(`| Tool failures | \`${metrics.mainFailureCount}\` |`);
    lines.push(`| Discovery calls | \`${metrics.mainClassificationCounts.discovery}\` |`);
    lines.push(`| Modification calls | \`${metrics.mainClassificationCounts.modification}\` |`);
    lines.push(`| Execution calls | \`${metrics.mainClassificationCounts.execution}\` |`);
    lines.push(`| External research calls | \`${metrics.mainClassificationCounts.external_research}\` |`);
    lines.push(`| Context compactions | \`${metrics.totalCompactions}\` |`);
    lines.push(`| Estimated observed output | \`${humanBytes(metrics.estimatedOutputBytes)}\` |`);
    lines.push("");
    lines.push("## Subagents", "");
    if (metrics.subagents.length === 0) {
        lines.push("No subagents were launched.");
    }
    else {
        lines.push("| Agent | Model | Duration | Tool calls | Failures |");
        lines.push("|---|---|---:|---:|---:|");
        for (const agent of metrics.subagents) {
            const agentLabel = agent.agentType ?? agent.id;
            lines.push(`| \`${agentLabel}\` | \`${agent.model ?? "unknown"}\` | \`${humanDuration(agent.durationMs)}\` | \`${agent.toolCallCount}\` | \`${agent.failureCount}\` |`);
        }
    }
    lines.push("");
    lines.push("## Recommendations", "");
    if (recommendations.length === 0) {
        lines.push("No material workflow inefficiencies were detected by the configured rules.");
    }
    else {
        recommendations.forEach((rec, idx) => {
            if (idx > 0)
                lines.push("");
            lines.push(...renderRecommendation(rec));
        });
    }
    lines.push("");
    lines.push("## Suggested Routing for Similar Work", "");
    lines.push("- Repository discovery and code tracing: `explore-cheap` / Haiku");
    lines.push("- Well-scoped implementation with validation: `implement-standard` / Sonnet");
    lines.push("- Repeated failures, ambiguous architecture, migration, concurrency, or difficult diagnosis: `architect-escalation` / Opus");
    lines.push("");
    lines.push("## Privacy", "");
    lines.push("This report contains aggregate telemetry only by default. It does not store source code, prompts, full tool inputs, full tool outputs, terminal logs, or secrets.");
    return lines.join("\n");
}
//# sourceMappingURL=report-renderer.js.map