import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { systemClock } from "../shared/clock.js";
const VALID_OUTCOMES = ["accepted", "rework", "failed"];
export function registerLabelCommand(program) {
    program
        .command("label")
        .argument("<outcome>", "accepted | rework | failed")
        .description("Label the latest unlabelled session's outcome")
        .action((outcome) => {
        runLabel(outcome);
    });
}
function runLabel(outcomeArg) {
    if (!isUserOutcome(outcomeArg)) {
        console.error(`Invalid outcome "${outcomeArg}". Expected one of: ${VALID_OUTCOMES.join(", ")}.`);
        process.exitCode = 1;
        return;
    }
    const { paths, config, db } = openRepo();
    try {
        const sessions = new SessionRepository(db);
        const record = sessions.latestCompletedUnlabelled(paths.repositoryHash);
        if (!record) {
            const latest = sessions.latestCompleted(paths.repositoryHash);
            const message = latest && latest.userOutcome
                ? `The latest completed session is already labelled "${latest.userOutcome}".`
                : "No completed sessions found to label yet.";
            console.error(message);
            process.exitCode = 1;
            return;
        }
        sessions.setUserOutcome(record.id, outcomeArg);
        const result = finalizeSession({
            db,
            sessionId: record.id,
            config,
            reportsDir: paths.reportsDir,
            createdAt: systemClock.nowIso(),
        });
        if (!result) {
            console.error(`Failed to regenerate report for session "${record.id}".`);
            process.exitCode = 1;
            return;
        }
        console.log(`Labelled session ${record.id} as "${outcomeArg}".`);
        console.log(result.reportPath);
    }
    finally {
        db.close();
    }
}
function isUserOutcome(value) {
    return VALID_OUTCOMES.includes(value);
}
//# sourceMappingURL=label-command.js.map