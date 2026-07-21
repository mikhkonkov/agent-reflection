import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
 *
 * The install targets the repo's own `.claude/settings.json` rather than the
 * global one: `CLAUDE_CONFIG_DIR` can point at a different profile depending
 * on how the session was launched (e.g. a plain terminal has no such env var
 * even when the active session's own config lives elsewhere), so a global
 * write can silently land in the wrong directory. Project-local settings are
 * unambiguous, and Claude Code already gives them precedence over the global
 * file, so this stays consistent with whatever is actually active.
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

/**
 * Seeds the project settings file with whatever statusLine command is
 * currently effective (global or project-local) so the installer's own
 * chain-preserving logic — which only looks at the target file — picks it up
 * instead of silently shadowing it. No-op if the project file already has its
 * own statusLine (the installer chains that directly) or if nothing foreign
 * is configured anywhere.
 */
function seedProjectChain(repoRoot: string): void {
  const projectSettingsPath = join(repoRoot, ".claude", "settings.json");
  if (readStatusLineCommand(projectSettingsPath) !== undefined) return;

  const foreign = [...settingsCandidates(repoRoot)]
    .reverse()
    .map(readStatusLineCommand)
    .find((cmd): cmd is string => cmd !== undefined && !cmd.includes("context-statusline.sh"));
  if (foreign === undefined) return;

  const existing: Record<string, unknown> = existsSync(projectSettingsPath)
    ? (JSON.parse(readFileSync(projectSettingsPath, "utf8") || "{}") as Record<string, unknown>)
    : {};
  existing.statusLine = { type: "command", command: foreign };
  mkdirSync(dirname(projectSettingsPath), { recursive: true });
  writeFileSync(projectSettingsPath, JSON.stringify(existing, null, 2) + "\n");
}

export function installStatusline(repoRoot: string): StatuslineInstallResult {
  const installer = installerPath();
  if (installer === undefined) return { status: "unavailable" };

  seedProjectChain(repoRoot);

  const run = spawnSync("bash", [installer, "--project"], { cwd: repoRoot, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();

  if (run.status === 0) return { status: "installed", output };
  return { status: "failed", output: output || (run.error?.message ?? "unknown error") };
}

/** True when the meter cannot be offered at all (running outside a checkout). */
export function statuslineAvailable(): boolean {
  return installerPath() !== undefined;
}

/**
 * True when the meter is already wired into a project-local settings file.
 * Deliberately skips the global candidate: `init` runs from a plain shell,
 * which has no reliable way to know which `CLAUDE_CONFIG_DIR` profile the
 * active session actually uses (a global install under one profile must not
 * suppress the project-local install this repo needs for a different one).
 */
export function statuslineAlreadyInstalled(repoRoot: string): boolean {
  return settingsCandidates(repoRoot)
    .slice(1)
    .map(readStatusLineCommand)
    .some((cmd) => cmd !== undefined && cmd.includes("context-statusline.sh"));
}
