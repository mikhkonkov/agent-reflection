import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  readStatusLineCommand,
  settingsCandidates,
  statuslineScript,
} from "../collector/statusline-nudge.js";

/**
 * Claude Code does not let a plugin register the main `statusLine` — it lives
 * in the user's own settings file. `statusline/install.sh` is the single source
 * of truth for that patch (it backs the file up and preserves an existing
 * statusline as a prefix); this just drives it from `init`.
 */
export type StatuslineInstallResult =
  | { status: "installed"; output: string }
  | { status: "unavailable" }
  | { status: "failed"; output: string };

function installerPath(): string | undefined {
  const meter = statuslineScript();
  if (meter === undefined) return undefined;
  const installer = join(dirname(meter), "install.sh");
  return existsSync(installer) ? installer : undefined;
}

export function installStatusline(): StatuslineInstallResult {
  const installer = installerPath();
  if (installer === undefined) return { status: "unavailable" };

  const run = spawnSync("bash", [installer], { encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();

  if (run.status === 0) return { status: "installed", output };
  return { status: "failed", output: output || (run.error?.message ?? "unknown error") };
}

/** True when the meter cannot be offered at all (running outside a checkout). */
export function statuslineAvailable(): boolean {
  return installerPath() !== undefined;
}

/** True when some settings file already points `statusLine` at the meter. */
export function statuslineAlreadyInstalled(repoRoot: string): boolean {
  return settingsCandidates(repoRoot)
    .map(readStatusLineCommand)
    .some((cmd) => cmd !== undefined && cmd.includes("context-statusline.sh"));
}
