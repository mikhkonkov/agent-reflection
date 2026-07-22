import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { effectiveStatusLine, isLiveMeter, readStatusLineCommand, settingsCandidates, statuslineScript, } from "../collector/statusline-nudge.js";
function installerPath() {
    const meter = statuslineScript();
    if (meter === undefined)
        return undefined;
    const installer = join(dirname(meter), "install.sh");
    return existsSync(installer) ? installer : undefined;
}
/**
 * Seeds the project settings file with whatever statusLine command is
 * currently effective (global or project-local) so the installer's own
 * chain-preserving logic — which only looks at the target file — picks it up
 * instead of silently shadowing it. No-op if the project file already has its
 * own statusLine (the installer chains that directly) or if nothing foreign
 * is configured anywhere.
 */
function seedProjectChain(repoRoot, target) {
    if (readStatusLineCommand(target) !== undefined)
        return;
    const foreign = effectiveStatusLine(repoRoot)?.command;
    if (foreign === undefined || foreign.includes("context-statusline.sh"))
        return;
    const existing = existsSync(target)
        ? JSON.parse(readFileSync(target, "utf8") || "{}")
        : {};
    existing.statusLine = { type: "command", command: foreign };
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(existing, null, 2) + "\n");
}
/**
 * Patch the project-local file that actually wins. Writing to
 * `settings.json` while a `settings.local.json` also defines `statusLine`
 * installs a meter nobody ever sees.
 */
function targetSettings(repoRoot) {
    const projectFiles = settingsCandidates(repoRoot).slice(1);
    const shadowing = [...projectFiles].reverse().find((f) => readStatusLineCommand(f) !== undefined);
    return shadowing ?? join(repoRoot, ".claude", "settings.json");
}
export function installStatusline(repoRoot) {
    const installer = installerPath();
    if (installer === undefined)
        return { status: "unavailable" };
    const target = targetSettings(repoRoot);
    seedProjectChain(repoRoot, target);
    const run = spawnSync("bash", [installer, `--target=${target}`], {
        cwd: repoRoot,
        encoding: "utf8",
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    if (run.status === 0)
        return { status: "installed", output };
    return { status: "failed", output: output || (run.error?.message ?? "unknown error") };
}
/** True when the meter cannot be offered at all (running outside a checkout). */
export function statuslineAvailable() {
    return installerPath() !== undefined;
}
/**
 * True when the meter is the statusLine that actually renders — the
 * highest-precedence project-local file, pointing at a script that still
 * exists. The global candidate is deliberately skipped: `init` runs from a
 * plain shell, which has no reliable way to know which `CLAUDE_CONFIG_DIR`
 * profile the active session uses (a global install under one profile must not
 * suppress the project-local install this repo needs for a different one).
 */
export function statuslineAlreadyInstalled(repoRoot) {
    const command = [...settingsCandidates(repoRoot).slice(1)]
        .reverse()
        .map(readStatusLineCommand)
        .find((cmd) => cmd !== undefined);
    return command !== undefined && isLiveMeter(command);
}
//# sourceMappingURL=statusline-setup.js.map