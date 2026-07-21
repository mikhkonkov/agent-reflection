import { describe, it, expect } from "vitest";
import { toRepoRelative, findRepoRoot } from "../../src/shared/paths.js";

const repo = "/home/user/project";

describe("toRepoRelative", () => {
  it("relativizes an absolute path inside the repo", () => {
    expect(toRepoRelative("/home/user/project/src/index.ts", repo)).toBe("src/index.ts");
  });

  it("keeps an already-relative path relative to the repo", () => {
    expect(toRepoRelative("src/app.ts", repo)).toBe("src/app.ts");
  });

  it("returns undefined for a path outside the repo", () => {
    expect(toRepoRelative("/etc/passwd", repo)).toBeUndefined();
    expect(toRepoRelative("/home/user/other/secret.txt", repo)).toBeUndefined();
  });

  it("returns '.' for the repo root itself", () => {
    expect(toRepoRelative(repo, repo)).toBe(".");
  });

  it("returns undefined for empty input", () => {
    expect(toRepoRelative("", repo)).toBeUndefined();
  });
});

describe("findRepoRoot", () => {
  it("falls back to the start directory when no .git is found", () => {
    // A path unlikely to have a .git ancestor within the sandbox tmp.
    const start = "/nonexistent-xyz/deep/dir";
    expect(findRepoRoot(start)).toBe(start);
  });
});
