import { openDatabase } from "../storage/database.js";
import { SessionRepository } from "../storage/session-repository.js";
import { EventRepository } from "../storage/event-repository.js";
import { SubagentRepository } from "../storage/subagent-repository.js";
import { resolveStoragePaths, ensureStorageDirs, detectGitBranch } from "../shared/paths.js";
import { loadConfig } from "../config/config-service.js";
import { systemClock } from "../shared/clock.js";
import { logger } from "../shared/logger.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { parseHookInput, getString } from "./hook-input-schema.js";
import { normalizeEvent } from "./event-normalizer.js";
import { appendEvent } from "./jsonl-writer.js";
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Print a single-line, low-noise summary to stdout at session end. */
function printSummary(result) {
    const top = result.recommendations
        .slice(0, 3)
        .map((rec) => `${rec.severity}:${rec.title}`)
        .join(", ");
    const line = top
        ? `[agent-auditor] report: ${result.reportPath} | ${top}`
        : `[agent-auditor] report: ${result.reportPath}`;
    try {
        process.stdout.write(`${line}\n`);
    }
    catch {
        /* never throw */
    }
}
/**
 * Entry point for the collector: parse a raw hook payload from stdin, persist
 * telemetry, and (on SessionEnd) trigger report finalization. Must fail safe —
 * every step is inside the outer try/catch and any failure degrades to a no-op
 * exit code 0, since a telemetry problem must never block Claude Code.
 */
export function runHook(rawStdin, cwd, clock = systemClock) {
    let db;
    try {
        let parsedJson;
        try {
            parsedJson = JSON.parse(rawStdin);
        }
        catch (error) {
            logger.warn("hook-router: invalid JSON on stdin", { error: errorMessage(error) });
            return 0;
        }
        const parsedHook = parseHookInput(parsedJson);
        if (!parsedHook.ok) {
            logger.warn("hook-router: hook payload failed validation");
            return 0;
        }
        const raw = parsedHook.value;
        const sessionId = raw.session_id;
        if (!sessionId) {
            logger.warn("hook-router: missing session_id");
            return 0;
        }
        const paths = resolveStoragePaths(cwd);
        ensureStorageDirs(paths);
        const config = loadConfig(paths.configPath);
        if (config.enabled === false)
            return 0;
        db = openDatabase(paths.dbPath);
        const sessions = new SessionRepository(db);
        const events = new EventRepository(db);
        const subagents = new SubagentRepository(db);
        const nowIso = clock.nowIso();
        if (raw.hook_event_name === "SessionStart") {
            const source = getString(raw, "source");
            const model = getString(raw, "model");
            sessions.insertIfAbsent({
                id: sessionId,
                repositoryHash: paths.repositoryHash,
                repositoryName: paths.repositoryName,
                gitBranch: detectGitBranch(paths.repoRoot),
                startedAt: nowIso,
                source,
                mainModel: model,
                createdAt: nowIso,
            });
            if (model !== undefined)
                sessions.setMainModel(sessionId, model);
        }
        else {
            // Ensure a session row exists even if SessionStart was missed (e.g. the
            // collector was installed mid-session), so events/subagents inserts that
            // reference session_id via foreign key always succeed.
            sessions.insertIfAbsent({
                id: sessionId,
                repositoryHash: paths.repositoryHash,
                repositoryName: paths.repositoryName,
                startedAt: nowIso,
                createdAt: nowIso,
            });
        }
        const normalized = normalizeEvent(raw, {
            sessionId,
            repoRoot: paths.repoRoot,
            config,
            nowIso,
        });
        if (!normalized)
            return 0;
        appendEvent(paths.eventsDir, sessionId, normalized);
        events.insert(normalized);
        switch (normalized.eventName) {
            case "user_prompt": {
                sessions.incrementPromptCount(sessionId);
                break;
            }
            case "post_tool_use": {
                sessions.incrementToolCall(sessionId, false);
                if (normalized.agentId && subagents.get(normalized.agentId)) {
                    subagents.incrementToolCall(normalized.agentId, false);
                }
                break;
            }
            case "post_tool_use_failure": {
                sessions.incrementToolCall(sessionId, true);
                if (normalized.agentId && subagents.get(normalized.agentId)) {
                    subagents.incrementToolCall(normalized.agentId, true);
                }
                break;
            }
            case "subagent_start": {
                if (normalized.agentId) {
                    subagents.insertIfAbsent({
                        id: normalized.agentId,
                        sessionId,
                        agentType: normalized.agentType,
                        startedAt: nowIso,
                    });
                    sessions.incrementSubagentCount(sessionId);
                }
                break;
            }
            case "subagent_stop": {
                if (normalized.agentId) {
                    subagents.markEnded(normalized.agentId, nowIso);
                }
                else {
                    // Heuristic: Claude Code's SubagentStop payload does not always carry
                    // an agent id. When absent, best-effort attribute the stop to the
                    // most recently started subagent in this session that has not yet
                    // ended. This can misattribute under concurrent subagents, but is a
                    // reasonable default given the payload's ambiguity.
                    const open = subagents.listBySession(sessionId).filter((s) => s.endedAt === undefined);
                    const last = open[open.length - 1];
                    if (last)
                        subagents.markEnded(last.id, nowIso);
                }
                break;
            }
            case "pre_compact": {
                sessions.incrementCompactCount(sessionId);
                break;
            }
            case "session_end": {
                sessions.markEnded(sessionId, nowIso, "completed");
                const result = finalizeSession({
                    db,
                    sessionId,
                    config,
                    reportsDir: paths.reportsDir,
                    createdAt: nowIso,
                });
                if (result && config.reports.printSummaryAtSessionEnd) {
                    printSummary(result);
                }
                break;
            }
            default:
                break;
        }
        return 0;
    }
    catch (error) {
        logger.error("hook-router: unhandled error", { error: errorMessage(error) });
        return 0;
    }
    finally {
        if (db) {
            try {
                db.close();
            }
            catch {
                /* never throw */
            }
        }
    }
}
//# sourceMappingURL=hook-router.js.map