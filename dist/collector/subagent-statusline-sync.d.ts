/**
 * Copies the subagent statusline script and its shared meter helper into the
 * fixed home-relative location `subagentStatusLine` is configured to run
 * from. Always overwrites — this is two small files copied once per session
 * start, not worth a staleness check. No-ops if the plugin's own copies are
 * missing (e.g. running the CLI outside a plugin install context), and never
 * throws: this runs inside a hook, which must never block the user.
 */
export declare function syncSubagentStatuslineScript(): void;
