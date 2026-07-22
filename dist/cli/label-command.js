import { openRepo } from "./context.js";
import { SessionRepository } from "../storage/session-repository.js";
import { resolveSessionSelector } from "./session-selector.js";
import { finalizeSession } from "../report/session-finalizer.js";
import { systemClock } from "../shared/clock.js";
const VALID_OUTCOMES = ["accepted", "rework", "failed"];
export function registerLabelCommand(program) {
    program
        .command("label")
        .argument("<outcome>", "accepted | rework | failed")
        .argument("[session]", "session id or id prefix, or 'current' (this session), 'previous' (last finished one), " +
        "'latest' (most recent of either); defaults to the active session, or the most " +
        "recent completed session without a label if there is none")
        .description("Label a session's outcome")
        .action((outcome, session) => {
        runLabel(outcome, session);
    });
}
function runLabel(outcomeArg, sessionArg) {
    if (!isUserOutcome(outcomeArg)) {
        console.error(`Invalid outcome "${outcomeArg}". Expected one of: ${VALID_OUTCOMES.join(", ")}.`);
        process.exitCode = 1;
        return;
    }
    const { paths, config, db } = openRepo();
    try {
        const sessions = new SessionRepository(db);
        const record = resolveTarget(sessions, paths.repositoryHash, sessionArg, outcomeArg);
        if (!record) {
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
/** Resolves which session to label, printing an error and returning undefined on failure. */
function resolveTarget(sessions, repositoryHash, sessionArg, outcomeArg) {
    if (sessionArg === undefined) {
        const record = sessions.latestActive(repositoryHash) ?? sessions.latestCompletedUnlabelled(repositoryHash);
        if (record)
            return record;
        const latest = sessions.latestCompleted(repositoryHash);
        const message = latest && latest.userOutcome
            ? `The latest completed session is already labelled "${latest.userOutcome}". ` +
                `Pass it explicitly to relabel: agent-auditor label ${outcomeArg} ${latest.id}`
            : "No completed sessions found to label yet.";
        console.error(message);
        process.exitCode = 1;
        return undefined;
    }
    const resolved = resolveSessionSelector(sessions, repositoryHash, sessionArg);
    if (resolved.kind === "not-found") {
        console.error(resolved.reason);
        process.exitCode = 1;
        return undefined;
    }
    if (resolved.kind === "ambiguous") {
        console.error(`Ambiguous session id "${sessionArg}". Matches:`);
        for (const match of resolved.matches) {
            console.error(`  ${match.id}  ${match.startedAt}`);
        }
        process.exitCode = 1;
        return undefined;
    }
    return resolved.record;
}
function isUserOutcome(value) {
    return VALID_OUTCOMES.includes(value);
}
//# sourceMappingURL=label-command.js.map