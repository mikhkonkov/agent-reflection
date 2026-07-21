import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clock } from "../../src/shared/clock.js";
import { runHook } from "../../src/collector/hook-router.js";
import { resolveStoragePaths } from "../../src/shared/paths.js";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function clock(): Clock {
  let t = Date.parse("2026-07-21T10:00:00.000Z");
  return {
    nowIso: () => {
      t += 1000;
      return new Date(t).toISOString();
    },
    nowMs: () => t,
  };
}

const SESSION = "sess-secrets";
const SECRETS = {
  apiKey: "sk-ant-SECRETKEYMATERIAL0123456789abcdefghij",
  env: "env-secret-9999",
  bearer: "bearer-secret-8888",
  password: "hunter2secret",
  pem: "MIISECRETPEMBODY7777",
};

function secretLadenEvents(): string[] {
  const pem = `-----BEGIN RSA PRIVATE KEY-----\n${SECRETS.pem}\n-----END RSA PRIVATE KEY-----`;
  return [
    { hook_event_name: "SessionStart", session_id: SESSION, source: "startup", model: "claude-sonnet-5" },
    {
      hook_event_name: "UserPromptSubmit",
      session_id: SESSION,
      prompt: `use ${SECRETS.apiKey} and ANTHROPIC_API_KEY=${SECRETS.env}`,
    },
    {
      hook_event_name: "PostToolUse",
      session_id: SESSION,
      tool_name: "Bash",
      tool_input: { command: `curl -H "Authorization: Bearer ${SECRETS.bearer}"` },
      tool_response: { content: [{ type: "text", text: `password=${SECRETS.password}\n${pem}` }] },
    },
    { hook_event_name: "SessionEnd", session_id: SESSION, reason: "clear" },
  ].map((e) => JSON.stringify(e));
}

function allPersistedText(cwd: string): string {
  const paths = resolveStoragePaths(cwd);
  const jsonl = readFileSync(join(paths.eventsDir, `${SESSION}.jsonl`), "utf8");
  const db = readFileSync(paths.dbPath).toString("latin1");
  const reportsDir = paths.reportsDir;
  let report = "";
  try {
    for (const f of readdirSync(reportsDir)) report += readFileSync(join(reportsDir, f), "utf8");
  } catch {
    /* no reports dir */
  }
  return `${jsonl}\n${db}\n${report}`;
}

describe("privacy (default config)", () => {
  it("never persists secrets in JSONL, SQLite, or the report", () => {
    const cwd = mkdtempSync(join(tmpdir(), "aa-priv-"));
    dirs.push(cwd);
    const c = clock();
    for (const line of secretLadenEvents()) expect(runHook(line, cwd, c)).toBe(0);

    const haystack = allPersistedText(cwd);
    for (const secret of Object.values(SECRETS)) {
      expect(haystack).not.toContain(secret);
    }
  });

  it("does not persist prompt text but does persist a prompt hash", () => {
    const cwd = mkdtempSync(join(tmpdir(), "aa-priv-"));
    dirs.push(cwd);
    const c = clock();
    for (const line of secretLadenEvents()) runHook(line, cwd, c);
    const paths = resolveStoragePaths(cwd);
    const jsonl = readFileSync(join(paths.eventsDir, `${SESSION}.jsonl`), "utf8");
    expect(jsonl).toContain("promptHash");
    expect(jsonl).not.toContain(SECRETS.apiKey);
  });
});

describe("privacy (raw payload mode enabled)", () => {
  it("redacts secrets even when storeRawPayloads is true", () => {
    const cwd = mkdtempSync(join(tmpdir(), "aa-priv-raw-"));
    dirs.push(cwd);
    const paths = resolveStoragePaths(cwd);
    mkdirSync(paths.baseDir, { recursive: true });
    writeFileSync(
      paths.configPath,
      JSON.stringify({
        privacy: { storeRawPayloads: true, storePromptText: true, storeToolOutput: true },
      }),
    );
    const c = clock();
    for (const line of secretLadenEvents()) expect(runHook(line, cwd, c)).toBe(0);

    const haystack = allPersistedText(cwd);
    for (const secret of Object.values(SECRETS)) {
      expect(haystack).not.toContain(secret);
    }
  });
});
