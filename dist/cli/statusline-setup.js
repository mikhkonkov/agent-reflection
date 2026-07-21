import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { readStatusLineCommand, settingsCandidates, statuslineScript, } from "../collector/statusline-nudge.js";
function installerPath() {
    const meter = statuslineScript();
    if (meter === undefined)
        return undefined;
    const installer = join(dirname(meter), "install.sh");
    return existsSync(installer) ? installer : undefined;
}
export function installStatusline() {
    const installer = installerPath();
    if (installer === undefined)
        return { status: "unavailable" };
    const run = spawnSync("bash", [installer], { encoding: "utf8" });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    if (run.status === 0)
        return { status: "installed", output };
    return { status: "failed", output: output || (run.error?.message ?? "unknown error") };
}
/** True when the meter cannot be offered at all (running outside a checkout). */
export function statuslineAvailable() {
    return installerPath() !== undefined;
}
/** True when some settings file already points `statusLine` at the meter. */
export function statuslineAlreadyInstalled(repoRoot) {
    return settingsCandidates(repoRoot)
        .map(readStatusLineCommand)
        .some((cmd) => cmd !== undefined && cmd.includes("context-statusline.sh"));
}
//# sourceMappingURL=statusline-setup.js.map