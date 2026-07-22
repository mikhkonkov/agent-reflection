import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { statuslineNudge } from "../../src/collector/statusline-nudge.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aa-statusline-"));
  dirs.push(d);
  return d;
}

const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
const originalPluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  restore("CLAUDE_CONFIG_DIR", originalConfigDir);
  restore("CLAUDE_PLUGIN_ROOT", originalPluginRoot);
});

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/** A plugin root containing the shipped meter script. */
function pluginRoot(): string {
  const root = tmp();
  mkdirSync(join(root, "statusline"));
  writeFileSync(join(root, "statusline", "context-statusline.sh"), "#!/bin/bash\n");
  process.env.CLAUDE_PLUGIN_ROOT = root;
  return root;
}

/** A user config dir, optionally with a statusLine already configured. */
function configDir(command?: string): string {
  const dir = tmp();
  const settings = command ? { statusLine: { type: "command", command } } : {};
  writeFileSync(join(dir, "settings.json"), JSON.stringify(settings));
  process.env.CLAUDE_CONFIG_DIR = dir;
  return dir;
}

function setup(command?: string): { repoRoot: string; baseDir: string } {
  pluginRoot();
  configDir(command);
  const repoRoot = tmp();
  const baseDir = join(repoRoot, ".agent-reflection");
  mkdirSync(baseDir);
  return { repoRoot, baseDir };
}

describe("statusline nudge", () => {
  it("offers the meter once when no statusline is configured", () => {
    const { repoRoot, baseDir } = setup();

    const first = statuslineNudge({ repoRoot, baseDir, enabled: true });
    expect(first).toContain("STATUSLINE METER AVAILABLE");
    expect(first).toContain("install.sh");
    expect(existsSync(join(baseDir, ".statusline-prompted"))).toBe(true);

    // Never twice: the marker suppresses every later session.
    expect(statuslineNudge({ repoRoot, baseDir, enabled: true })).toBeUndefined();
  });

  it("stays silent when disabled by config", () => {
    const { repoRoot, baseDir } = setup();
    expect(statuslineNudge({ repoRoot, baseDir, enabled: false })).toBeUndefined();
    expect(existsSync(join(baseDir, ".statusline-prompted"))).toBe(false);
  });

  it("stays silent when the meter is already wired up", () => {
    const { repoRoot, baseDir } = setup('bash "/somewhere/statusline/context-statusline.sh"');
    expect(statuslineNudge({ repoRoot, baseDir, enabled: true })).toBeUndefined();
  });

  it("promises to preserve an unrelated statusline", () => {
    const { repoRoot, baseDir } = setup('bash "/somewhere/other-badge.sh"');
    expect(statuslineNudge({ repoRoot, baseDir, enabled: true })).toContain("keeps it as a prefix");
  });

  it("reads project settings too, not just the user config dir", () => {
    const { repoRoot, baseDir } = setup();
    mkdirSync(join(repoRoot, ".claude"));
    writeFileSync(
      join(repoRoot, ".claude", "settings.local.json"),
      JSON.stringify({ statusLine: { command: 'bash "x/statusline/context-statusline.sh"' } }),
    );
    expect(statuslineNudge({ repoRoot, baseDir, enabled: true })).toBeUndefined();
  });

  it("ignores an unparsable settings file rather than throwing", () => {
    const { repoRoot, baseDir } = setup();
    writeFileSync(join(process.env.CLAUDE_CONFIG_DIR!, "settings.json"), "{ not json");
    expect(statuslineNudge({ repoRoot, baseDir, enabled: true })).toContain("STATUSLINE METER");
  });
});
