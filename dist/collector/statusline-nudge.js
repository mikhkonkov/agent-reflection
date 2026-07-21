import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../shared/logger.js";
/**
 * Claude Code lets a plugin ship `subagentStatusLine`, but not the main
 * `statusLine` — that one lives in the user's own settings file. So the meter
 * cannot install itself; the most a plugin can do is say it exists once, and
 * let the user decide.
 *
 * This produces the SessionStart context for that single offer. It stays quiet
 * when a statusline is already configured, when the user has been told before,
 * or when `statusline.promptOnSessionStart` is false.
 */
const MARKER = ".statusline-prompted";
/** Settings files that can define `statusLine`, lowest precedence first. */
export function settingsCandidates(repoRoot) {
    const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
    return [
        join(configDir, "settings.json"),
        join(repoRoot, ".claude", "settings.json"),
        join(repoRoot, ".claude", "settings.local.json"),
    ];
}
export function readStatusLineCommand(file) {
    try {
        if (!existsSync(file))
            return undefined;
        const parsed = JSON.parse(readFileSync(file, "utf8"));
        if (typeof parsed !== "object" || parsed === null)
            return undefined;
        const statusLine = parsed.statusLine;
        if (typeof statusLine === "string")
            return statusLine;
        if (typeof statusLine === "object" && statusLine !== null) {
            const command = statusLine.command;
            if (typeof command === "string")
                return command;
        }
        return undefined;
    }
    catch {
        // A settings file we cannot parse is not ours to complain about.
        return undefined;
    }
}
/**
 * Absolute path to the shipped meter script. Claude Code sets
 * CLAUDE_PLUGIN_ROOT for plugin hook commands; the module-relative fallback
 * keeps this working when the CLI is run directly from a checkout.
 */
export function statuslineScript() {
    const root = process.env.CLAUDE_PLUGIN_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const script = join(root, "statusline", "context-statusline.sh");
    return existsSync(script) ? script : undefined;
}
/**
 * Returns the SessionStart context to print, or undefined to stay silent.
 * Writes the marker as a side effect, so the offer is made at most once per
 * repository.
 */
export function statuslineNudge(options) {
    if (!options.enabled)
        return undefined;
    const markerPath = join(options.baseDir, MARKER);
    if (existsSync(markerPath))
        return undefined;
    const script = statuslineScript();
    if (!script)
        return undefined;
    const existing = settingsCandidates(options.repoRoot)
        .map(readStatusLineCommand)
        .filter((cmd) => cmd !== undefined);
    // Already using the meter — nothing to offer, and never ask again.
    if (existing.some((cmd) => cmd.includes("context-statusline.sh"))) {
        writeMarker(markerPath);
        return undefined;
    }
    writeMarker(markerPath);
    const installer = join(dirname(script), "install.sh");
    const preserves = existing.length > 0
        ? " The user already has a statusline; the installer keeps it as a prefix rather than replacing it, and restores it on uninstall."
        : "";
    return [
        "AGENT AUDITOR — STATUSLINE METER AVAILABLE (mention once, then drop it):",
        "Agent Auditor ships a statusline context meter — a traffic-light bar for how full the context window is",
        "(green under 60%, amber to 85%, red above) plus the tokens spent, and a per-agent meter on subagent rows.",
        "Claude Code does not let a plugin register the main statusLine, so it is opt-in and not active yet.",
        `To enable it, run: agent-auditor init --statusline (or directly: bash "${installer}")`,
        `It points statusLine at "${script}" in the user's settings and writes a .bak first.${preserves}`,
        "Offer this to the user once, and only run the installer if they say yes. Never edit their settings otherwise.",
        "To silence this offer: agent-auditor config set statusline.promptOnSessionStart false",
    ].join(" ");
}
function writeMarker(markerPath) {
    try {
        writeFileSync(markerPath, new Date().toISOString());
    }
    catch (error) {
        // Failing to write the marker means the offer repeats; not worth failing on.
        logger.debug("statusline-nudge: could not write marker", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
//# sourceMappingURL=statusline-nudge.js.map