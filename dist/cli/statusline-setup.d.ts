/**
 * Claude Code does not let a plugin register the main `statusLine` — it lives
 * in the user's own settings file. `statusline/install.sh` is the single source
 * of truth for that patch (it backs the file up and preserves an existing
 * statusline as a prefix); this just drives it from `init`.
 *
 * The install targets the repo's own `.claude/settings.json` rather than the
 * global one: `CLAUDE_CONFIG_DIR` can point at a different profile depending
 * on how the session was launched (e.g. a plain terminal has no such env var
 * even when the active session's own config lives elsewhere), so a global
 * write can silently land in the wrong directory. Project-local settings are
 * unambiguous, and Claude Code already gives them precedence over the global
 * file, so this stays consistent with whatever is actually active.
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
export declare function installStatusline(repoRoot: string): StatuslineInstallResult;
/** True when the meter cannot be offered at all (running outside a checkout). */
export declare function statuslineAvailable(): boolean;
/**
 * True when the meter is already wired into a project-local settings file.
 * Deliberately skips the global candidate: `init` runs from a plain shell,
 * which has no reliable way to know which `CLAUDE_CONFIG_DIR` profile the
 * active session actually uses (a global install under one profile must not
 * suppress the project-local install this repo needs for a different one).
 */
export declare function statuslineAlreadyInstalled(repoRoot: string): boolean;
