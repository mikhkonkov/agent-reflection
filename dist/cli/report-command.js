import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { systemClock } from "../shared/clock.js";
export function registerReportCommand(program) {
    program
        .command("report")
        .argument("[session]", "session id or id prefix, or 'latest'", "latest")
        .description("Show a session's audit report")
        .action((session) => {
        runReport(session);
    });
}
function runReport(sessionArg) {
    const { paths, config, db } = openRepo();
    try {
        const sessions = new SessionRepository(db);
        let record;
        if (sessionArg === "latest") {
            // Fall back to the still-active session so a report can be produced
            // mid-session, not only after the session has ended.
            record =
                sessions.latestCompleted(paths.repositoryHash) ??
                    sessions.latest(paths.repositoryHash);
            if (!record) {
                console.error("No sessions recorded yet for this repository.");
                process.exitCode = 1;
                return;
            }
        }
        else {
            const exact = sessions.get(sessionArg);
            const matches = exact
                ? [exact]
                : sessions.findByShortPrefix(paths.repositoryHash, sessionArg);
            if (matches.length === 0) {
                console.error(`No session found with id "${sessionArg}".`);
                process.exitCode = 1;
                return;
            }
            if (matches.length > 1) {
                console.error(`Ambiguous session id "${sessionArg}". Matches:`);
                for (const match of matches) {
                    console.error(`  ${match.id}  ${match.startedAt}`);
                }
                process.exitCode = 1;
                return;
            }
            record = matches[0];
        }
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
            console.error("Session is still active — the report covers activity so far.");
        }
        console.log(result.reportPath);
        console.log(result.markdown);
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=report-command.js.map