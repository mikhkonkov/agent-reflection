/** Settings files that can define `statusLine`, lowest precedence first. */
export declare function settingsCandidates(repoRoot: string): string[];
/**
 * The statusLine Claude Code actually renders: highest precedence wins, the
 * lower files are dead weight. Checking "any file mentions the meter" instead
 * reports it active while a `settings.local.json` silently shadows it.
 */
export declare function effectiveStatusLine(repoRoot: string): {
    file: string;
    command: string;
} | undefined;
/**
 * True when the command runs a meter script that still exists — a settings file
 * left pointing at a moved or renamed checkout is not an installation.
 */
export declare function isLiveMeter(command: string): boolean;
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
