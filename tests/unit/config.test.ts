import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, setConfigValue } from "../../src/config/config-service.js";
import { defaultConfig } from "../../src/config/defaults.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aa-config-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns defaults when the file is missing", () => {
    const cfg = loadConfig(join(tmp(), "config.json"));
    expect(cfg).toEqual(defaultConfig());
  });

  it("returns defaults on invalid JSON", () => {
    const p = join(tmp(), "config.json");
    writeFileSync(p, "{ not valid json");
    expect(loadConfig(p)).toEqual(defaultConfig());
  });

  it("returns defaults when the schema is violated", () => {
    const p = join(tmp(), "config.json");
    writeFileSync(p, JSON.stringify({ thresholds: { repeatedFailureCount: -1 } }));
    expect(loadConfig(p)).toEqual(defaultConfig());
  });

  it("loads and merges a partial valid config", () => {
    const p = join(tmp(), "config.json");
    writeFileSync(p, JSON.stringify({ thresholds: { repeatedFailureCount: 5 } }));
    const cfg = loadConfig(p);
    expect(cfg.thresholds.repeatedFailureCount).toBe(5);
    // untouched thresholds keep defaults
    expect(cfg.thresholds.excessiveExplorationCalls).toBe(15);
    expect(cfg.privacy.storeRawPayloads).toBe(false);
  });
});

describe("setConfigValue", () => {
  it("sets a nested boolean, coercing the string", () => {
    const updated = setConfigValue(defaultConfig(), "privacy.storeRawPayloads", "true");
    expect(updated.privacy.storeRawPayloads).toBe(true);
  });

  it("sets a nested number", () => {
    const updated = setConfigValue(defaultConfig(), "thresholds.repeatedFailureCount", "7");
    expect(updated.thresholds.repeatedFailureCount).toBe(7);
  });

  it("throws on an invalid value", () => {
    expect(() =>
      setConfigValue(defaultConfig(), "thresholds.explorationCallRatio", "5"),
    ).toThrow();
  });
});
