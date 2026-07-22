import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../shared/logger.js";

/**
 * Claude Code does not expand `${CLAUDE_PLUGIN_ROOT}` for the
 * `subagentStatusLine.command` field (unlike `hooks/hooks.json`, where the
 * same variable works). The only pattern that works is a bare literal path
 * with no interpreter prefix, relying on the script's own shebang, pointing
 * at a fixed, already-installed, home-relative location — see `settings.json`
 * and `CLAUDE.md`.
 *
 * That fixed location is not populated on a fresh plugin install, so this
 * keeps it in sync on every SessionStart: it copies the shipped
 * `subagent-statusline.sh` and its `meter.sh` dependency from the plugin's
 * own `statusline/` directory into that fixed location, self-healing the
 * "just works, no user setup" property without requiring the opt-in
 * `statusline/install.sh` step (which is for the main `statusLine` meter).
 */

const SCRIPT_NAMES = ["subagent-statusline.sh", "meter.sh"] as const;

/**
 * Absolute path to the plugin's own statusline directory. Mirrors
 * `statuslineScript()` in `statusline-nudge.ts`.
 */
function pluginStatuslineDir(): string {
  const root =
    process.env.CLAUDE_PLUGIN_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return join(root, "statusline");
}

/** Fixed target directory `subagentStatusLine` in settings.json points at. */
function targetStatuslineDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  return join(configDir, "agent-reflection", "statusline");
}

/**
 * Copies the subagent statusline script and its shared meter helper into the
 * fixed home-relative location `subagentStatusLine` is configured to run
 * from. Always overwrites — this is two small files copied once per session
 * start, not worth a staleness check. No-ops if the plugin's own copies are
 * missing (e.g. running the CLI outside a plugin install context), and never
 * throws: this runs inside a hook, which must never block the user.
 */
export function syncSubagentStatuslineScript(): void {
  try {
    const sourceDir = pluginStatuslineDir();
    const sourcePaths = SCRIPT_NAMES.map((name) => join(sourceDir, name));
    if (!sourcePaths.every((path) => existsSync(path))) return;

    const targetDir = targetStatuslineDir();
    mkdirSync(targetDir, { recursive: true });

    for (const name of SCRIPT_NAMES) {
      copyFileSync(join(sourceDir, name), join(targetDir, name));
    }
    chmodSync(join(targetDir, "subagent-statusline.sh"), 0o755);
  } catch (error) {
    logger.debug("subagent-statusline-sync: could not sync scripts", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
