import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  effectiveStatusLine,
  isLiveMeter,
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
function seedProjectChain(repoRoot: string, target: string): void {
  if (readStatusLineCommand(target) !== undefined) return;

  const foreign = effectiveStatusLine(repoRoot)?.command;
  if (foreign === undefined || foreign.includes("context-statusline.sh")) return;

  const existing: Record<string, unknown> = existsSync(target)
    ? (JSON.parse(readFileSync(target, "utf8") || "{}") as Record<string, unknown>)
    : {};
  existing.statusLine = { type: "command", command: foreign };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(existing, null, 2) + "\n");
}

/**
 * Patch the project-local file that actually wins. Writing to
 * `settings.json` while a `settings.local.json` also defines `statusLine`
 * installs a meter nobody ever sees.
 */
function targetSettings(repoRoot: string): string {
  const projectFiles = settingsCandidates(repoRoot).slice(1);
  const shadowing = [...projectFiles].reverse().find((f) => readStatusLineCommand(f) !== undefined);
  return shadowing ?? join(repoRoot, ".claude", "settings.json");
}

export function installStatusline(repoRoot: string): StatuslineInstallResult {
  const installer = installerPath();
  if (installer === undefined) return { status: "unavailable" };

  const target = targetSettings(repoRoot);
  seedProjectChain(repoRoot, target);

  const run = spawnSync("bash", [installer, `--target=${target}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();

  if (run.status === 0) return { status: "installed", output };
  return { status: "failed", output: output || (run.error?.message ?? "unknown error") };
}

/** True when the meter cannot be offered at all (running outside a checkout). */
export function statuslineAvailable(): boolean {
  return installerPath() !== undefined;
}

/**
 * True when the meter is the statusLine that actually renders — the
 * highest-precedence project-local file, pointing at a script that still
 * exists. The global candidate is deliberately skipped: `init` runs from a
 * plain shell, which has no reliable way to know which `CLAUDE_CONFIG_DIR`
 * profile the active session uses (a global install under one profile must not
 * suppress the project-local install this repo needs for a different one).
 */
export function statuslineAlreadyInstalled(repoRoot: string): boolean {
  const command = [...settingsCandidates(repoRoot).slice(1)]
    .reverse()
    .map(readStatusLineCommand)
    .find((cmd): cmd is string => cmd !== undefined);
  return command !== undefined && isLiveMeter(command);
}
