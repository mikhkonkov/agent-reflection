import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTokenUsage } from "../../src/report/token-usage.js";
import { totalTokens } from "../../src/domain/token-usage.js";

/** Write a JSONL transcript to a temp file and return its path. */
function transcript(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "aa-usage-"));
  const path = join(dir, "session.jsonl");
  writeFileSync(path, lines.map((line) => JSON.stringify(line)).join("\n"), "utf8");
  return path;
}

function assistant(
  model: string,
  usage: Record<string, number>,
  extra: Record<string, unknown> = {},
): unknown {
  return { type: "assistant", ...extra, message: { model, usage } };
}

describe("readTokenUsage", () => {
  it("sums usage per model", () => {
    const path = transcript([
      assistant("claude-opus-4-8", { input_tokens: 10, output_tokens: 100 }),
      assistant("claude-opus-4-8", {
        input_tokens: 5,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 1000,
      }),
    ]);

    const usage = readTokenUsage(path);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      model: "claude-opus-4-8",
      scope: "main",
      inputTokens: 15,
      outputTokens: 150,
      cacheCreationTokens: 200,
      cacheReadTokens: 1000,
      messageCount: 2,
    });
    expect(totalTokens(usage[0]!)).toBe(1365);
  });

  it("separates subagent (sidechain) spend from the main loop", () => {
    const path = transcript([
      assistant("claude-opus-4-8", { output_tokens: 100 }),
      assistant("claude-haiku-4-5", { output_tokens: 20 }, { isSidechain: true }),
    ]);

    const usage = readTokenUsage(path);
    expect(usage.map((u) => [u.model, u.scope])).toEqual([
      ["claude-opus-4-8", "main"],
      ["claude-haiku-4-5", "subagent"],
    ]);
  });

  it("sorts the heaviest spend first", () => {
    const path = transcript([
      assistant("cheap", { output_tokens: 10 }),
      assistant("expensive", { output_tokens: 9000 }),
    ]);
    expect(readTokenUsage(path).map((u) => u.model)).toEqual(["expensive", "cheap"]);
  });

  it("skips synthetic messages and entries without usage", () => {
    const path = transcript([
      { type: "user", message: { role: "user", content: "hi" } },
      assistant("<synthetic>", { output_tokens: 0 }),
      assistant("claude-opus-4-8", { output_tokens: 7 }),
    ]);
    const usage = readTokenUsage(path);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.outputTokens).toBe(7);
  });

  it("degrades to an empty list rather than throwing", () => {
    expect(readTokenUsage(undefined)).toEqual([]);
    expect(readTokenUsage("/nonexistent/transcript.jsonl")).toEqual([]);

    const dir = mkdtempSync(join(tmpdir(), "aa-usage-bad-"));
    const path = join(dir, "broken.jsonl");
    writeFileSync(path, "{not json\n\n{}\n", "utf8");
    expect(readTokenUsage(path)).toEqual([]);
  });
});
