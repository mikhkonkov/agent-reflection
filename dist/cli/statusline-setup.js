import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readStatusLineCommand, settingsCandidates, statuslineScript, } from "../collector/statusline-nudge.js";
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
function seedProjectChain(repoRoot) {
    const projectSettingsPath = join(repoRoot, ".claude", "settings.json");
    if (readStatusLineCommand(projectSettingsPath) !== undefined)
        return;
    const foreign = [...settingsCandidates(repoRoot)]
        .reverse()
        .map(readStatusLineCommand)
        .find((cmd) => cmd !== undefined && !cmd.includes("context-statusline.sh"));
    if (foreign === undefined)
        return;
    const existing = existsSync(projectSettingsPath)
        ? JSON.parse(readFileSync(projectSettingsPath, "utf8") || "{}")
        : {};
    existing.statusLine = { type: "command", command: foreign };
    mkdirSync(dirname(projectSettingsPath), { recursive: true });
    writeFileSync(projectSettingsPath, JSON.stringify(existing, null, 2) + "\n");
}
export function installStatusline(repoRoot) {
    const installer = installerPath();
    if (installer === undefined)
        return { status: "unavailable" };
    seedProjectChain(repoRoot);
    const run = spawnSync("bash", [installer, "--project"], { cwd: repoRoot, encoding: "utf8" });
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
 * True when the meter is already wired into a project-local settings file.
 * Deliberately skips the global candidate: `init` runs from a plain shell,
 * which has no reliable way to know which `CLAUDE_CONFIG_DIR` profile the
 * active session actually uses (a global install under one profile must not
 * suppress the project-local install this repo needs for a different one).
 */
export function statuslineAlreadyInstalled(repoRoot) {
    return settingsCandidates(repoRoot)
        .slice(1)
        .map(readStatusLineCommand)
        .some((cmd) => cmd !== undefined && cmd.includes("context-statusline.sh"));
}
//# sourceMappingURL=statusline-setup.js.map