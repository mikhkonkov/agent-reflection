import type { SessionView } from "../domain/metrics.js";
import type { Recommendation, RecommendationSeverity } from "../domain/recommendation.js";
import { totalTokens, type ModelTokenUsage } from "../domain/token-usage.js";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Format a millisecond duration as e.g. "18m 22s", or "unknown" when absent. */
export function humanDuration(ms?: number): string {
  if (ms === undefined) return "unknown";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Format a byte count as e.g. "1.2 MB". */
export function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  let value = n;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = unitIndex === 0 ? `${Math.round(value)}` : value.toFixed(1);
  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

function severityLabel(severity: RecommendationSeverity): string {
  switch (severity) {
    case "high":
      return "High";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
  }
}

/** Format a token count as e.g. "3.9M", "104.2K", "156". */
export function humanTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** "affectedRelativePaths" -> "Affected relative paths". */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function stringifyEvidenceValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "none";
  if (Array.isArray(value)) return value.length === 0 ? "[]" : JSON.stringify(value);
  return JSON.stringify(value);
}

/**
 * Evidence is the rule's own working data — useful when a recommendation looks
 * wrong, noise otherwise. It is collapsed so the prose above it stays readable.
 */
function renderEvidence(evidence: Record<string, unknown>): string[] {
  const entries = Object.entries(evidence);
  if (entries.length === 0) return [];
  return [
    "<details>",
    "<summary>Evidence</summary>",
    "",
    ...entries.map(([key, value]) => `- ${humanizeKey(key)}: \`${stringifyEvidenceValue(value)}\``),
    "",
    "</details>",
  ];
}

function renderRecommendation(rec: Recommendation): string[] {
  const lines = [
    `### ${severityLabel(rec.severity)} — ${rec.title}`,
    "",
    `**What happened.** ${rec.rationale}`,
    "",
    `**What to do.** ${rec.suggestedAction}`,
    "",
  ];

  if (rec.command !== undefined) {
    lines.push("```", rec.command, "```", "");
  }

  lines.push(`_Rule \`${rec.ruleId}\`, confidence ${rec.confidence.toFixed(2)}._`, "");
  lines.push(...renderEvidence(rec.evidence));
  return lines;
}

/** Severity first, then confidence — the order a user should work through. */
function byPriority(a: Recommendation, b: Recommendation): number {
  const rank: Record<RecommendationSeverity, number> = { high: 0, warning: 1, info: 2 };
  const bySeverity = rank[a.severity] - rank[b.severity];
  return bySeverity !== 0 ? bySeverity : b.confidence - a.confidence;
}

/**
 * The report's lede: every recommendation reduced to one imperative line, in
 * priority order.
 */
function renderNextSteps(recommendations: Recommendation[]): string[] {
  const steps: string[] = [];

  for (const rec of [...recommendations].sort(byPriority)) {
    const command = rec.command === undefined ? "" : ` — \`${rec.command}\``;
    steps.push(`${rec.suggestedAction}${command}`);
  }

  if (steps.length === 0) return [];

  return [
    "## What To Do Next",
    "",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
  ];
}

/**
 * Per-model token spend. Omitted entirely when the transcript was unreadable,
 * rather than rendering a table of zeroes.
 */
function renderTokenUsage(usage: ModelTokenUsage[] | undefined): string[] {
  if (usage === undefined || usage.length === 0) return [];

  const lines = ["## Cumulative Token Usage by Model", ""];
  lines.push(
    "| Model | Scope | Input | Output | Cache write | Cache read | Cumulative total | Messages |",
  );
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|");

  for (const row of usage) {
    lines.push(
      `| \`${row.model}\` | ${row.scope} | ${humanTokens(row.inputTokens)} | ` +
        `${humanTokens(row.outputTokens)} | ${humanTokens(row.cacheCreationTokens)} | ` +
        `${humanTokens(row.cacheReadTokens)} | ${humanTokens(totalTokens(row))} | ${row.messageCount} |`,
    );
  }

  const grandTotal = usage.reduce((sum, row) => sum + totalTokens(row), 0);
  lines.push("");
  lines.push(`Cumulative API tokens (all calls): \`${humanTokens(grandTotal)}\`.`);
  lines.push("");

  return lines;
}

/**
 * Render the deterministic Markdown audit report for a session. Uses only
 * `view` and `recommendations` — never the clock or any other I/O.
 */
export function renderReport(view: SessionView, recommendations: Recommendation[]): string {
  const { session, metrics } = view;

  const lines: string[] = [];

  lines.push("# Agent Reflection Report", "");

  // Actions first: the report is read top-down, and the steps are the point.
  lines.push(...renderNextSteps(recommendations));

  lines.push("## Session", "");
  lines.push(`- Session ID: \`${session.id}\``);
  lines.push(`- Repository: \`${session.repositoryName}\``);
  lines.push(`- Branch: \`${session.gitBranch ?? "unknown"}\``);
  lines.push(`- Started: \`${session.startedAt}\``);
  const durationSuffix =
    session.status === "active" && metrics.durationMs !== undefined ? " (so far)" : "";
  lines.push(`- Duration: \`${humanDuration(metrics.durationMs)}\`${durationSuffix}`);
  lines.push(`- Main model: \`${metrics.mainModel ?? "unknown"}\``);
  lines.push(`- Subagents: \`${metrics.subagents.length}\``);
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
  lines.push(
    `| External research calls | \`${metrics.mainClassificationCounts.external_research}\` |`,
  );
  lines.push(`| Context compactions | \`${metrics.totalCompactions}\` |`);
  lines.push(`| Estimated observed output | \`${humanBytes(metrics.estimatedOutputBytes)}\` |`);
  lines.push("");

  lines.push(...renderTokenUsage(view.tokenUsage));

  lines.push("## Subagents", "");
  if (metrics.subagents.length === 0) {
    lines.push("No subagents were launched.");
  } else {
    lines.push("| Agent | Duration | Tool calls | Failures |");
    lines.push("|---|---:|---:|---:|");
    for (const agent of metrics.subagents) {
      const agentLabel = agent.agentType ?? agent.id;
      lines.push(
        `| \`${agentLabel}\` | \`${humanDuration(agent.durationMs)}\` | \`${agent.toolCallCount}\` | \`${agent.failureCount}\` |`,
      );
    }
  }
  lines.push("");

  lines.push("## Recommendations", "");
  if (recommendations.length === 0) {
    lines.push("No material workflow inefficiencies were detected by the configured rules.");
  } else {
    [...recommendations].sort(byPriority).forEach((rec, idx) => {
      if (idx > 0) lines.push("");
      lines.push(...renderRecommendation(rec));
    });
  }
  lines.push("");

  lines.push("## Suggested Routing for Similar Work", "");
  lines.push("- Repository discovery and code tracing: `explore-cheap` / Haiku");
  lines.push("- Well-scoped implementation with validation: `implement-standard` / Sonnet");
  lines.push(
    "- Repeated failures, ambiguous architecture, migration, concurrency, or difficult diagnosis: `architect-escalation` / Opus",
  );
  lines.push("");

  lines.push("## Privacy", "");
  lines.push(
    "This report contains aggregate telemetry only by default. It does not store source code, prompts, full tool inputs, full tool outputs, terminal logs, or secrets.",
  );

  return lines.join("\n");
}
