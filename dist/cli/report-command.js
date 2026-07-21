import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { systemClock } from "../shared/clock.js";
export function registerReportCommand(program) {
    program
        .command("report")
        .argument("[session]", "session id, or 'latest'", "latest")
        .description("Show a session's audit report")
        .action((session) => {
        runReport(session);
    });
}
function runReport(sessionArg) {
    const { paths, config, db } = openRepo();
    try {
        const sessions = new SessionRepository(db);
        const record = sessionArg === "latest"
            ? sessions.latestCompleted(paths.repositoryHash)
            : sessions.get(sessionArg);
        if (!record) {
            const message = sessionArg === "latest"
                ? "No completed sessions found for this repository yet."
                : `No session found with id "${sessionArg}".`;
            console.error(message);
            process.exitCode = 1;
            return;
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
        console.log(result.reportPath);
        console.log(result.markdown);
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=report-command.js.map