import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { resolveSessionSelector } from "./session-selector.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { systemClock } from "../shared/clock.js";
export function registerReportCommand(program) {
    program
        .command("report")
        .argument("[session]", "session id or id prefix, or 'current' (this session), 'previous' (last finished one), 'latest' (most recent of either)", "latest")
        .description("Show a session's audit report")
        .action((session) => {
        runReport(session);
    });
}
function runReport(sessionArg) {
    const { paths, config, db } = openRepo();
    try {
        const sessions = new SessionRepository(db);
        const resolved = resolveSessionSelector(sessions, paths.repositoryHash, sessionArg);
        if (resolved.kind === "not-found") {
            console.error(resolved.reason);
            process.exitCode = 1;
            return;
        }
        if (resolved.kind === "ambiguous") {
            console.error(`Ambiguous session id "${sessionArg}". Matches:`);
            for (const match of resolved.matches) {
                console.error(`  ${match.id}  ${match.startedAt}`);
            }
            process.exitCode = 1;
            return;
        }
        const record = resolved.record;
        const result = finalizeSession({
            db,
            sessionId: record.id,
            config,
            reportsDir: paths.reportsDir,
            createdAt: systemClock.nowIso(),
        });
        if (!result) {
            console.error(`No session found with id "${record.id}".`);
            process.exitCode = 1;
            return;
        }
        if (record.status === "active") {
            console.error("Session is still active — the report covers activity so far. " +
                "For the last session that finished, run: agent-reflection report previous");
        }
        console.log(result.reportPath);
        console.log(result.markdown);
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=report-command.js.map