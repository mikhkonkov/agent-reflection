import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SessionRepository } from "../storage/session-repository.js";
import { EventRepository } from "../storage/event-repository.js";
import { SubagentRepository } from "../storage/subagent-repository.js";
import { isPendingSubagentId } from "../domain/subagent.js";
import { RecommendationRepository } from "../storage/recommendation-repository.js";
import { aggregate } from "../analysis/session-aggregator.js";
import { runRules } from "../analysis/rule-engine.js";
import { renderReport } from "../analysis/report-renderer.js";
import { readTokenUsage, dominantMainModel } from "./token-usage.js";
/**
 * Load a session's telemetry, run analysis, persist recommendations, render the
 * Markdown report, and (when configured) write it to disk. Idempotent: existing
 * recommendations for the session are replaced, so it is safe to re-run.
 * Returns null when the session does not exist.
 *
 * The report file name uses the session's start DATE (derived from stored data),
 * keeping output deterministic and independent of wall-clock time.
 */
export function finalizeSession(params) {
    const { db, sessionId, config, reportsDir, createdAt } = params;
    const sessions = new SessionRepository(db);
    const events = new EventRepository(db);
    const subagentsRepo = new SubagentRepository(db);
    const recommendations = new RecommendationRepository(db);
    const session = sessions.get(sessionId);
    if (!session)
        return null;
    const eventList = events.listBySession(sessionId);
    // Rows still holding a placeholder id were never bound to a real agent (the
    // launch was observed, the agent's own events were not), so they carry no
    // metrics worth reporting.
    const subagentRecords = subagentsRepo
        .listBySession(sessionId)
        .filter((sub) => !isPendingSubagentId(sub.id));
    const metrics = aggregate({
        session,
        events: eventList,
        subagents: subagentRecords,
        now: createdAt,
    });
    const tokenUsage = readTokenUsage(session.transcriptPath);
    // The SessionStart payload does not always carry `model`, leaving main_model
    // unset. The transcript knows which model actually ran, so recover it from
    // there and persist it (setMainModel only fills a NULL, never overwrites).
    if (metrics.mainModel === undefined) {
        const recovered = dominantMainModel(tokenUsage);
        if (recovered !== undefined) {
            metrics.mainModel = recovered;
            session.mainModel = recovered;
            sessions.setMainModel(sessionId, recovered);
        }
    }
    const view = { session, metrics, subagentRecords, tokenUsage };
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
//# sourceMappingURL=session-finalizer.js.map