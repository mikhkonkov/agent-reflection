import type { Command } from "commander";
import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { SubagentRepository } from "../storage/subagent-repository.js";
import { RecommendationRepository } from "../storage/recommendation-repository.js";
import { humanDuration } from "../analysis/report-renderer.js";

interface StatsOptions {
  days?: string;
}

export function registerStatsCommand(program: Command): void {
  program
    .command("stats")
    .description("Show aggregate usage statistics across sessions")
    .option("--days <n>", "number of days to include", "30")
    .action((options: StatsOptions) => {
      runStats(options);
    });
}

function runStats(options: StatsOptions): void {
  const { db } = openRepo();
  try {
    const days = parsePositiveInt(options.days, 30);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const sessionRepo = new SessionRepository(db);
    const subagentRepo = new SubagentRepository(db);
    const recommendationRepo = new RecommendationRepository(db);

    const all = sessionRepo.listSince(cutoff);

    console.log(`Stats for the last ${days} day(s)`);
    console.log("");

    if (all.length === 0) {
      console.log("No sessions recorded in this period.");
      return;
    }

    const completed = all.filter((s) => s.status === "completed");
    console.log(`Completed sessions: ${completed.length}`);

    const durations = completed
      .filter((s) => s.endedAt !== undefined)
      .map((s) => new Date(s.endedAt as string).getTime() - new Date(s.startedAt).getTime());
    console.log(
      `Average duration: ${durations.length > 0 ? humanDuration(mean(durations)) : "-"}`,
    );
    console.log(`Average tool calls: ${formatMean(completed.map((s) => s.toolCallCount))}`);
    console.log(`Average failures: ${formatMean(completed.map((s) => s.toolFailureCount))}`);

    const withCompaction = completed.filter((s) => s.compactCount > 0).length;
    const compactionPct = completed.length > 0 ? (withCompaction / completed.length) * 100 : 0;
    console.log(`Sessions with >=1 compaction: ${compactionPct.toFixed(1)}%`);

    console.log("");
    console.log("Subagent use by type:");
    const typeTally = new Map<string, number>();
    for (const session of all) {
      for (const sub of subagentRepo.listBySession(session.id)) {
        const key = sub.agentType ?? "unknown";
        typeTally.set(key, (typeTally.get(key) ?? 0) + 1);
      }
    }
    printTally(typeTally);

    console.log("");
    console.log("Recommendation frequencies:");
    const ruleCounts = recommendationRepo.countByRuleSince(cutoff);
    printTally(new Map(Object.entries(ruleCounts)));

    console.log("");
    console.log("User outcomes:");
    const outcomeTally = { accepted: 0, rework: 0, failed: 0, unlabelled: 0 };
    for (const session of all) {
      if (session.userOutcome === "accepted") outcomeTally.accepted += 1;
      else if (session.userOutcome === "rework") outcomeTally.rework += 1;
      else if (session.userOutcome === "failed") outcomeTally.failed += 1;
      else outcomeTally.unlabelled += 1;
    }
    console.log(`  accepted: ${outcomeTally.accepted}`);
    console.log(`  rework: ${outcomeTally.rework}`);
    console.log(`  failed: ${outcomeTally.failed}`);
    console.log(`  unlabelled: ${outcomeTally.unlabelled}`);

    console.log("");
    console.log("Top repositories by session count:");
    const repoTally = new Map<string, number>();
    for (const session of all) {
      repoTally.set(session.repositoryName, (repoTally.get(session.repositoryName) ?? 0) + 1);
    }
    printTally(repoTally, 10);
  } finally {
    db.close();
  }
}

function printTally(tally: Map<string, number>, limit?: number): void {
  if (tally.size === 0) {
    console.log("  (none)");
    return;
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const entries = limit === undefined ? sorted : sorted.slice(0, limit);
  for (const [key, count] of entries) {
    console.log(`  ${key}: ${count}`);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function formatMean(values: number[]): string {
  if (values.length === 0) return "-";
  return mean(values).toFixed(1);
}
