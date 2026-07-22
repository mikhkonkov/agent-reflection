import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncSubagentStatuslineScript } from "../../src/collector/subagent-statusline-sync.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aa-subagent-sync-"));
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

/** A plugin root containing the shipped subagent statusline scripts. */
function pluginRoot(): string {
  const root = tmp();
  mkdirSync(join(root, "statusline"));
  writeFileSync(join(root, "statusline", "subagent-statusline.sh"), "#!/bin/bash\necho hi\n");
  writeFileSync(join(root, "statusline", "meter.sh"), "#!/bin/bash\n");
  process.env.CLAUDE_PLUGIN_ROOT = root;
  return root;
}

function configDir(): string {
  const dir = tmp();
  process.env.CLAUDE_CONFIG_DIR = dir;
  return dir;
}

describe("subagent statusline sync", () => {
  it("copies the scripts into the fixed config-dir location and makes the entrypoint executable", () => {
    pluginRoot();
    const dir = configDir();

    syncSubagentStatuslineScript();

    const targetDir = join(dir, "agent-reflection", "statusline");
    const script = join(targetDir, "subagent-statusline.sh");
    const meter = join(targetDir, "meter.sh");

    expect(existsSync(script)).toBe(true);
    expect(existsSync(meter)).toBe(true);

    const mode = statSync(script).mode & 0o777;
    expect(mode & 0o100).toBe(0o100); // owner-executable
  });

  it("overwrites an existing stale copy", () => {
    pluginRoot();
    const dir = configDir();
    const targetDir = join(dir, "agent-reflection", "statusline");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "subagent-statusline.sh"), "stale");

    syncSubagentStatuslineScript();

    const contents = readFileSync(join(targetDir, "subagent-statusline.sh"), "utf8");
    expect(contents).toContain("echo hi");
  });

  it("no-ops when the plugin's own scripts are missing, without throwing", () => {
    const root = tmp();
    process.env.CLAUDE_PLUGIN_ROOT = root; // statusline/ dir does not exist here
    const dir = configDir();

    expect(() => syncSubagentStatuslineScript()).not.toThrow();
    expect(existsSync(join(dir, "agent-reflection", "statusline", "subagent-statusline.sh"))).toBe(false);
  });
});
