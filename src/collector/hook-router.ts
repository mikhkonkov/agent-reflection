import type { DatabaseHandle } from "../storage/database.js";
import { openDatabase } from "../storage/database.js";
import { SessionRepository } from "../storage/session-repository.js";
import { EventRepository } from "../storage/event-repository.js";
import { SubagentRepository } from "../storage/subagent-repository.js";
import { resolveStoragePaths, ensureStorageDirs, detectGitBranch } from "../shared/paths.js";
import { loadConfig } from "../config/config-service.js";
import { systemClock, type Clock } from "../shared/clock.js";
import { logger } from "../shared/logger.js";
import { finalizeSession, type FinalizeResult } from "../report/session-finalizer.js";
import { parseHookInput, getString } from "./hook-input-schema.js";
import { normalizeEvent } from "./event-normalizer.js";
import { appendEvent } from "./jsonl-writer.js";
import { statuslineNudge } from "./statusline-nudge.js";
import { syncSubagentStatuslineScript } from "./subagent-statusline-sync.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** How the session ended, phrased for a human. Unknown reasons are shown as-is. */
const END_REASONS: Record<string, string> = {
  clear: "/clear",
  logout: "logout",
  prompt_input_exit: "exit",
  resume: "saved for resume",
  bypass_permissions_disabled: "permissions restored",
  other: "ended",
};

/**
 * SessionEnd stdout is shown to the user but never added to Claude's context,
 * and the hook cannot block — so this is the last chance to point at the report.
 * Keep it to a few lines: it lands right as the user is leaving or clearing.
 */
function printSummary(result: FinalizeResult, reason: string | undefined, repoRoot: string): void {
  const how = reason === undefined ? "ended" : (END_REASONS[reason] ?? reason);
  const counts = countBySeverity(result.recommendations);
  const total = result.recommendations.length;

  const lines = [`[agent-auditor] session ended (${how})`];
  if (total > 0) {
    const breakdown = counts.length > 0 ? ` · ${counts.join(", ")}` : "";
    lines.push(`  ${total} recommendation${total === 1 ? "" : "s"}${breakdown}`);
  } else {
    lines.push("  no recommendations");
  }
  lines.push(`  ${relativeToRepo(result.reportPath, repoRoot)}`);
  if (total > 0) lines.push("  agent-auditor report");

  try {
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch {
    /* never throw */
  }
}

/** Severity tallies in fixed order, so the summary stays deterministic. */
function countBySeverity(recommendations: FinalizeResult["recommendations"]): string[] {
  const order = ["high", "warning", "info"] as const;
  return order
    .map((severity) => ({
      severity,
      count: recommendations.filter((rec) => rec.severity === severity).length,
    }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${entry.severity}`);
}

function relativeToRepo(absolute: string, repoRoot: string): string {
  const prefix = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
  return absolute.startsWith(prefix) ? absolute.slice(prefix.length) : absolute;
}

/**
 * Entry point for the collector: parse a raw hook payload from stdin, persist
 * telemetry, and (on SessionEnd) trigger report finalization. Must fail safe —
 * every step is inside the outer try/catch and any failure degrades to a no-op
 * exit code 0, since a telemetry problem must never block Claude Code.
 */
export function runHook(rawStdin: string, cwd: string, clock: Clock = systemClock): number {
  let db: DatabaseHandle | undefined;
  try {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawStdin);
    } catch (error) {
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
    if (config.enabled === false) return 0;

    db = openDatabase(paths.dbPath);
    const sessions = new SessionRepository(db);
    const events = new EventRepository(db);
    const subagents = new SubagentRepository(db);

    const nowIso = clock.nowIso();
    const transcriptPath = getString(raw, "transcript_path");

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
      if (model !== undefined) sessions.setMainModel(sessionId, model);

      // subagentStatusLine ignores ${CLAUDE_PLUGIN_ROOT} and must point at a
      // fixed home-relative path (see subagent-statusline-sync.ts). Keep that
      // path's copy fresh on every session start; it never throws, so a
      // failure here cannot abort the rest of SessionStart handling.
      syncSubagentStatuslineScript();

      // SessionStart stdout is added to the session context. This is the only
      // moment the plugin can tell the user the statusline meter exists, since
      // it cannot register itself (see statusline-nudge.ts).
      const nudge = statuslineNudge({
        repoRoot: paths.repoRoot,
        baseDir: paths.baseDir,
        enabled: config.statusline.promptOnSessionStart,
      });
      if (nudge) {
        try {
          process.stdout.write(`${nudge}\n`);
        } catch {
          /* never throw */
        }
      }
    } else {
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

    // Every hook payload carries it, so record it whenever it is seen: a
    // session that missed SessionStart still ends up with a transcript to read
    // token usage from.
    if (transcriptPath !== undefined) sessions.setTranscriptPath(sessionId, transcriptPath);

    const normalized = normalizeEvent(raw, {
      sessionId,
      repoRoot: paths.repoRoot,
      config,
      nowIso,
    });
    if (!normalized) return 0;

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
        } else {
          // Heuristic: Claude Code's SubagentStop payload does not always carry
          // an agent id. When absent, best-effort attribute the stop to the
          // most recently started subagent in this session that has not yet
          // ended. This can misattribute under concurrent subagents, but is a
          // reasonable default given the payload's ambiguity.
          const open = subagents.listBySession(sessionId).filter((s) => s.endedAt === undefined);
          const last = open[open.length - 1];
          if (last) subagents.markEnded(last.id, nowIso);
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
          printSummary(result, getString(raw, "reason"), paths.repoRoot);
        }
        break;
      }

      default:
        break;
    }

    return 0;
  } catch (error) {
    logger.error("hook-router: unhandled error", { error: errorMessage(error) });
    return 0;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        /* never throw */
      }
    }
  }
}
