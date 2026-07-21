import { existsSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { resolveStoragePaths, ensureStorageDirs } from "../shared/paths.js";
import { writeDefaultConfig } from "../config/config-service.js";
import { openDatabase } from "../storage/database.js";
const GITIGNORE_ENTRY = ".agent-auditor/";
export function registerInitCommand(program) {
    program
        .command("init")
        .description("Initialize Agent Auditor storage for this repository")
        .action(async () => {
        await runInit();
    });
}
async function runInit() {
    const paths = resolveStoragePaths(process.cwd());
    ensureStorageDirs(paths);
    let configCreated = false;
    if (!existsSync(paths.configPath)) {
        writeDefaultConfig(paths.configPath);
        configCreated = true;
    }
    const db = openDatabase(paths.dbPath);
    db.close();
    await maybeUpdateGitignore(paths.repoRoot);
    printSummary(paths, configCreated);
}
/**
 * Ask (via stdin) whether to append the storage directory to `.gitignore`.
 * Only writes on an affirmative answer; skips entirely when stdin is not a TTY.
 */
async function maybeUpdateGitignore(repoRoot) {
    if (!process.stdin.isTTY)
        return;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
        answer = await rl.question(`Add ${GITIGNORE_ENTRY} to .gitignore? [y/N] `);
    }
    finally {
        rl.close();
    }
    if (!/^y(es)?$/i.test(answer.trim()))
        return;
    const gitignorePath = join(repoRoot, ".gitignore");
    const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
    const alreadyPresent = existing
        .split("\n")
        .some((line) => line.trim() === GITIGNORE_ENTRY);
    if (alreadyPresent)
        return;
    const needsLeadingNewline = existing.length > 0 && !existing.endsWith("\n");
    appendFileSync(gitignorePath, `${needsLeadingNewline ? "\n" : ""}${GITIGNORE_ENTRY}\n`, "utf8");
}
function printSummary(paths, configCreated) {
    console.log("Agent Auditor initialized.");
    console.log("");
    console.log(`Storage location: ${paths.baseDir}${paths.usingFallback ? " (fallback: repo directory not writable)" : ""}`);
    console.log(`Config: ${paths.configPath}${configCreated ? " (created with defaults)" : " (existing config kept)"}`);
    console.log("");
    console.log("Privacy: telemetry is aggregate and privacy-safe by default. Raw prompts, tool output,");
    console.log("and payloads are NOT stored unless explicitly enabled in config.");
    console.log("");
    console.log("Commands:");
    console.log("  agent-auditor report [session]   Show a session's audit report");
    console.log("  agent-auditor sessions            List recent sessions");
    console.log("  agent-auditor stats                Aggregate usage stats");
    console.log("  agent-auditor label <outcome>      Label the latest session's outcome");
    console.log("  agent-auditor config <show|set>    View or edit configuration");
}
//# sourceMappingURL=init-command.js.map