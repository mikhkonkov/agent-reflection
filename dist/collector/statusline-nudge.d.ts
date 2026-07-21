/** Settings files that can define `statusLine`, lowest precedence first. */
export declare function settingsCandidates(repoRoot: string): string[];
export declare function readStatusLineCommand(file: string): string | undefined;
/**
 * Absolute path to the shipped meter script. Claude Code sets
 * CLAUDE_PLUGIN_ROOT for plugin hook commands; the module-relative fallback
 * keeps this working when the CLI is run directly from a checkout.
 */
export declare function statuslineScript(): string | undefined;
export interface StatuslineNudgeOptions {
    repoRoot: string;
    /** Storage base dir; the "already offered" marker is written here. */
    baseDir: string;
    enabled: boolean;
}
/**
 * Returns the SessionStart context to print, or undefined to stay silent.
 * Writes the marker as a side effect, so the offer is made at most once per
 * repository.
 */
export declare function statuslineNudge(options: StatuslineNudgeOptions): string | undefined;
