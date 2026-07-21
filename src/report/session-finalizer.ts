import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseHandle } from "../storage/database.js";
import { SessionRepository } from "../storage/session-repository.js";
import { EventRepository } from "../storage/event-repository.js";
import { SubagentRepository } from "../storage/subagent-repository.js";
import { RecommendationRepository } from "../storage/recommendation-repository.js";
import { aggregate } from "../analysis/session-aggregator.js";
import { runRules } from "../analysis/rule-engine.js";
import { renderReport } from "../analysis/report-renderer.js";
import type { AuditorConfig } from "../config/config-schema.js";
import type { SessionView } from "../domain/metrics.js";
import type { Recommendation } from "../domain/recommendation.js";

export interface FinalizeParams {
  db: DatabaseHandle;
  sessionId: string;
  config: AuditorConfig;
  reportsDir: string;
  /** ISO timestamp used only for recommendation bookkeeping (never rendered). */
  createdAt: string;
}

export interface FinalizeResult {
  reportPath: string;
  markdown: string;
  recommendations: Recommendation[];
  view: SessionView;
}

/**
 * Load a session's telemetry, run analysis, persist recommendations, render the
 * Markdown report, and (when configured) write it to disk. Idempotent: existing
 * recommendations for the session are replaced, so it is safe to re-run after a
 * label change. Returns null when the session does not exist.
 *
 * The report file name uses the session's start DATE (derived from stored data),
 * keeping output deterministic and independent of wall-clock time.
 */
export function finalizeSession(params: FinalizeParams): FinalizeResult | null {
  const { db, sessionId, config, reportsDir, createdAt } = params;

  const sessions = new SessionRepository(db);
  const events = new EventRepository(db);
  const subagentsRepo = new SubagentRepository(db);
  const recommendations = new RecommendationRepository(db);

  const session = sessions.get(sessionId);
  if (!session) return null;

  const eventList = events.listBySession(sessionId);
  const subagentRecords = subagentsRepo.listBySession(sessionId);

  const metrics = aggregate({ session, events: eventList, subagents: subagentRecords });
  const view: SessionView = { session, metrics, subagentRecords };

  const recs = runRules({ metrics, events: eventList, session, config });

  recommendations.deleteBySession(sessionId);
  recommendations.insertMany(sessionId, recs, createdAt);

  const markdown = renderReport(view, recs);

  const datePart = session.startedAt.slice(0, 10);
  const reportPath = join(reportsDir, `${datePart}-${sessionId}.md`);

  if (config.reports.writeMarkdown) {
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(reportPath, markdown, "utf8");
  }

  return { reportPath, markdown, recommendations: recs, view };
}
