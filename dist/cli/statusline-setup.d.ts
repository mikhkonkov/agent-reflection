/**
 * Claude Code does not let a plugin register the main `statusLine` — it lives
 * in the user's own settings file. `statusline/install.sh` is the single source
 * of truth for that patch (it backs the file up and preserves an existing
 * statusline as a prefix); this just drives it from `init`.
 */
export type StatuslineInstallResult = {
    status: "installed";
    output: string;
} | {
    status: "unavailable";
} | {
    status: "failed";
    output: string;
};
export declare function installStatusline(): StatuslineInstallResult;
/** True when the meter cannot be offered at all (running outside a checkout). */
export declare function statuslineAvailable(): boolean;
/** True when some settings file already points `statusLine` at the meter. */
export declare function statuslineAlreadyInstalled(repoRoot: string): boolean;
