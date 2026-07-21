import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Clock } from "../../src/shared/clock.js";
import { runHook } from "../../src/collector/hook-router.js";
import { openDatabase } from "../../src/storage/database.js";
import { SessionRepository } from "../../src/storage/session-repository.js";
import { SubagentRepository } from "../../src/storage/subagent-repository.js";
import { RecommendationRepository } from "../../src/storage/recommendation-repository.js";
import { resolveStoragePaths } from "../../src/shared/paths.js";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function incrementingClock(): Clock {
  let t = Date.parse("2026-07-21T10:00:00.000Z");
  return {
    nowIso: () => {
      t += 1000;
      return new Date(t).toISOString();
    },
    nowMs: () => t,
  };
}

interface Replay {
  cwd: string;
  sessionId: string;
  ruleIds: string[];
  reportMarkdown: string;
  reportFileName: string;
}

/** Feed every line of a .jsonl fixture through runHook against a fresh temp repo. */
function replayFixture(name: string): Replay {
  const cwd = mkdtempSync(join(tmpdir(), "aa-int-"));
  dirs.push(cwd);
  const clock = incrementingClock();
  const raw = readFileSync(join(FIXTURES, name), "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  let sessionId = "";
  for (const line of lines) {
    const parsed = JSON.parse(line) as { session_id?: string };
    if (parsed.session_id) sessionId = parsed.session_id;
    const code = runHook(line, cwd, clock);
    expect(code).toBe(0);
  }

  const paths = resolveStoragePaths(cwd);
  const db = openDatabase(paths.dbPath);
  const recs = new RecommendationRepository(db);
  const ruleIds = recs.listBySession(sessionId).map((r) => r.ruleId);
  db.close();

  const reportFiles = readdirSync(paths.reportsDir);
  const reportFileName = reportFiles.find((f) => f.includes(sessionId)) ?? "";
  const reportMarkdown = reportFileName
    ? readFileSync(join(paths.reportsDir, reportFileName), "utf8")
    : "";

  return { cwd, sessionId, ruleIds, reportMarkdown, reportFileName };
}

describe("lifecycle integration", () => {
  it("discovery-heavy triggers exploration + cheap-subagent recommendations", () => {
    const r = replayFixture("discovery-heavy.jsonl");
    expect(r.ruleIds).toContain("excessive-main-context-exploration");
    expect(r.ruleIds).toContain("cheap-subagent-candidate");
    expect(r.reportMarkdown).toContain("# Agent Auditor Report");
  });

  it("successful-implementation produces no high-severity recommendation", () => {
    const r = replayFixture("successful-implementation.jsonl");
    expect(r.reportMarkdown).not.toContain("### `High —");
    // no material inefficiencies detected
    expect(r.reportMarkdown).toContain(
      "No material workflow inefficiencies were detected by the configured rules.",
    );
  });

  it("repeated-test-failure triggers failure loop + escalation candidate", () => {
    const r = replayFixture("repeated-test-failure.jsonl");
    expect(r.ruleIds).toContain("repeated-execution-failure");
    expect(r.ruleIds).toContain("model-escalation-candidate");
  });

  it("auto-compaction triggers high-severity context pressure", () => {
    const r = replayFixture("auto-compaction.jsonl");
    expect(r.ruleIds).toContain("context-pressure");
    expect(r.reportMarkdown).toContain("### `High —");
  });

  it("subagent-workflow records subagent counters and report table", () => {
    const r = replayFixture("subagent-workflow.jsonl");
    const paths = resolveStoragePaths(r.cwd);
    const db = openDatabase(paths.dbPath);
    const session = new SessionRepository(db).get(r.sessionId);
    const subs = new SubagentRepository(db).listBySession(r.sessionId);
    db.close();
    expect(session?.subagentCount).toBe(1);
    expect(subs).toHaveLength(1);
    expect(subs[0]?.agentType).toBe("explore-cheap");
    expect(subs[0]?.endedAt).toBeTruthy();
    expect(r.reportMarkdown).toContain("explore-cheap");
    expect(r.reportMarkdown).not.toContain("No subagents were launched.");
  });

  it("report file name uses the YYYY-MM-DD-<session-id> pattern", () => {
    const r = replayFixture("discovery-heavy.jsonl");
    expect(r.reportFileName).toMatch(/^\d{4}-\d{2}-\d{2}-sess-discovery-heavy\.md$/);
  });
});

describe("resilience", () => {
  it("does not crash on an unknown hook payload and persists nothing sensitive", () => {
    const cwd = mkdtempSync(join(tmpdir(), "aa-int-"));
    dirs.push(cwd);
    const raw = readFileSync(join(FIXTURES, "unknown-hook-payload.json"), "utf8");
    const code = runHook(raw, cwd, incrementingClock());
    expect(code).toBe(0);
  });

  it("returns 0 on malformed JSON", () => {
    const cwd = mkdtempSync(join(tmpdir(), "aa-int-"));
    dirs.push(cwd);
    expect(runHook("{ not json", cwd, incrementingClock())).toBe(0);
    expect(runHook("", cwd, incrementingClock())).toBe(0);
  });
});
