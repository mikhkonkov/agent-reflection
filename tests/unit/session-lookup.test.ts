import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openInMemoryDatabase, type DatabaseHandle } from "../../src/storage/database.js";
import { SessionRepository } from "../../src/storage/session-repository.js";

const REPO = "repo-hash-a";
const OTHER_REPO = "repo-hash-b";

let db: DatabaseHandle;
let sessions: SessionRepository;

function insert(id: string, startedAt: string, repositoryHash = REPO): void {
  sessions.insertIfAbsent({
    id,
    repositoryHash,
    repositoryName: "demo",
    startedAt,
    createdAt: startedAt,
  });
}

beforeEach(() => {
  db = openInMemoryDatabase();
  sessions = new SessionRepository(db);
});

afterEach(() => {
  db.close();
});

describe("findByShortPrefix", () => {
  it("matches the dash-stripped prefix shown by shortId", () => {
    insert("85313702-6876-4710-9670-bb5ea89fb4e6", "2026-07-21T09:15:00.000Z");

    const matches = sessions.findByShortPrefix(REPO, "85313702");

    expect(matches.map((m) => m.id)).toEqual(["85313702-6876-4710-9670-bb5ea89fb4e6"]);
  });

  it("matches a prefix spanning a dash boundary", () => {
    insert("85313702-6876-4710-9670-bb5ea89fb4e6", "2026-07-21T09:15:00.000Z");

    expect(sessions.findByShortPrefix(REPO, "853137026876")).toHaveLength(1);
  });

  it("returns every match, newest first, when the prefix is ambiguous", () => {
    insert("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T09:00:00.000Z");
    insert("aaaa2222-0000-0000-0000-000000000002", "2026-07-21T09:00:00.000Z");

    const matches = sessions.findByShortPrefix(REPO, "aaaa");

    expect(matches.map((m) => m.id)).toEqual([
      "aaaa2222-0000-0000-0000-000000000002",
      "aaaa1111-0000-0000-0000-000000000001",
    ]);
  });

  it("does not match sessions from another repository", () => {
    insert("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T09:00:00.000Z", OTHER_REPO);

    expect(sessions.findByShortPrefix(REPO, "aaaa")).toEqual([]);
  });

  it("treats LIKE wildcards as no match rather than matching everything", () => {
    insert("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T09:00:00.000Z");

    expect(sessions.findByShortPrefix(REPO, "%")).toEqual([]);
    expect(sessions.findByShortPrefix(REPO, "_")).toEqual([]);
    expect(sessions.findByShortPrefix(REPO, "")).toEqual([]);
  });
});

describe("latest", () => {
  it("returns the most recent session regardless of status", () => {
    insert("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T09:00:00.000Z");
    sessions.markEnded("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T10:00:00.000Z");
    insert("bbbb2222-0000-0000-0000-000000000002", "2026-07-21T09:00:00.000Z");

    expect(sessions.latest(REPO)?.id).toBe("bbbb2222-0000-0000-0000-000000000002");
    expect(sessions.latestCompleted(REPO)?.id).toBe(
      "aaaa1111-0000-0000-0000-000000000001",
    );
  });

  it("is scoped to the repository", () => {
    insert("aaaa1111-0000-0000-0000-000000000001", "2026-07-20T09:00:00.000Z", OTHER_REPO);

    expect(sessions.latest(REPO)).toBeUndefined();
  });
});
