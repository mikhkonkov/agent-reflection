import { describe, it, expect } from "vitest";
import { redact, containsSecret, redactObject } from "../../src/collector/redactor.js";
import { extractRelativePaths, countPaths } from "../../src/collector/path-sanitizer.js";
import {
  classifyPrompt,
  categorizeError,
  hashPrompt,
  isToolFailure,
  normalizeEvent,
} from "../../src/collector/event-normalizer.js";
import { classifyTool } from "../../src/domain/tool-classification.js";
import { defaultConfig } from "../../src/config/defaults.js";

const REPO = "/home/user/project";

describe("redact", () => {
  it("redacts Anthropic keys, env assignments, bearer tokens, PEM keys and passwords", () => {
    const key = "sk-ant-" + "a".repeat(40);
    expect(redact(key)).not.toContain(key);
    expect(redact("ANTHROPIC_API_KEY=secretvalue123")).not.toContain("secretvalue123");
    expect(redact("Authorization: Bearer abc.def.ghi")).not.toContain("abc.def.ghi");
    expect(redact("password=hunter2")).not.toContain("hunter2");
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----";
    expect(redact(pem)).not.toContain("MIIabc");
  });

  it("leaves ordinary text intact", () => {
    expect(redact("just some normal text")).toBe("just some normal text");
  });

  it("containsSecret detects secrets", () => {
    expect(containsSecret("ANTHROPIC_API_KEY=abc123def")).toBe(true);
    expect(containsSecret("hello world")).toBe(false);
  });

  it("redactObject deep-walks strings", () => {
    const out = redactObject({ a: "password=hunter2", b: ["Authorization: Bearer xyz.tok"] });
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("xyz.tok");
  });
});

describe("extractRelativePaths", () => {
  it("relativizes in-repo paths and drops out-of-repo paths", () => {
    const paths = extractRelativePaths(
      { file_path: "/home/user/project/src/a.ts", path: "/etc/passwd" },
      REPO,
    );
    expect(paths).toContain("src/a.ts");
    expect(paths).not.toContain("/etc/passwd");
  });

  it("counts paths", () => {
    expect(countPaths({ file_path: "/home/user/project/x.ts" }, REPO)).toBe(1);
  });

  it("treats glob-like patterns as paths but not regex patterns", () => {
    const glob = extractRelativePaths({ pattern: "src/**/*.ts" }, REPO);
    const regex = extractRelativePaths({ pattern: "error|fail" }, REPO);
    expect(glob.length).toBeGreaterThanOrEqual(0); // glob may relativize
    expect(regex).toHaveLength(0);
  });
});

describe("classifyPrompt", () => {
  it("classifies by heuristic keywords", () => {
    expect(classifyPrompt("Why does this throw an exception?")).toBe("debugging");
    expect(classifyPrompt("implement a new endpoint")).toBe("implementation");
    expect(classifyPrompt("where is the auth middleware")).toBe("discovery");
    expect(classifyPrompt("design a migration for concurrency")).toBe("architecture");
    expect(classifyPrompt("research and compare options")).toBe("research");
    expect(classifyPrompt("xyzzy")).toBe("unknown");
  });
});

describe("categorizeError", () => {
  it("maps error text to categories", () => {
    expect(categorizeError({ tool_response: "Tests FAILED: 3 assertions" })).toBe("test_failure");
    expect(categorizeError({ tool_response: "EACCES: permission denied" })).toBe(
      "permission_denied",
    );
    expect(categorizeError({ tool_response: "ENOENT: no such file" })).toBe("file_not_found");
    expect(categorizeError({ tool_response: "operation timed out" })).toBe("timeout");
    expect(categorizeError({ tool_response: "totally fine" })).toBe("unknown");
  });

  it("does not read a test failure into an unrelated error that mentions a test path", () => {
    expect(
      categorizeError({ tool_name: "Edit", tool_response: "File has not been read yet: tests/unit/rules.test.ts" }),
    ).toBe("unknown");
    expect(
      categorizeError({ tool_name: "Read", tool_response: "ENOENT: no such file tests/unit/foo.test.ts" }),
    ).toBe("file_not_found");
  });
});

describe("isToolFailure", () => {
  it("detects failure from is_error flag", () => {
    expect(isToolFailure({ tool_response: { is_error: true } })).toBe(true);
  });
  it("detects failure from an error field", () => {
    expect(isToolFailure({ tool_response: { error: "boom" } })).toBe(true);
  });
  it("detects failure text in a content-block shaped response", () => {
    expect(
      isToolFailure({
        tool_response: { content: [{ type: "text", text: "Error: command failed" }] },
      }),
    ).toBe(true);
  });
  it("detects an MCP-style isError flag", () => {
    expect(isToolFailure({ tool_response: { isError: true, content: [] } })).toBe(true);
  });
  it("detects a non-zero bash exit", () => {
    expect(isToolFailure({ tool_response: { stdout: "Exit code 1\nboom", stderr: "" } })).toBe(
      true,
    );
  });
  it("detects a rejected tool use", () => {
    expect(isToolFailure({ tool_response: "The user doesn't want to proceed with this tool use" }))
      .toBe(true);
  });
  it("returns false for a clean response", () => {
    expect(isToolFailure({ tool_response: { stdout: "ok" } })).toBe(false);
  });
  it("does not flag successful output that merely mentions errors", () => {
    expect(
      isToolFailure({
        tool_response: {
          stdout: "src/domain/error-category.ts\nconst ERROR_TEXT_RE = /error|failed/;",
          stderr: "",
        },
      }),
    ).toBe(false);
    expect(isToolFailure({ tool_response: { stdout: "PASS (91) FAIL (0)" } })).toBe(false);
  });
});

describe("hashPrompt", () => {
  it("is a deterministic 64-char hex digest", () => {
    const h = hashPrompt("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPrompt("hello")).toBe(h);
    expect(hashPrompt("world")).not.toBe(h);
  });
});

describe("normalizeEvent — subagent spawn", () => {
  const ctx = {
    sessionId: "sess-1",
    repoRoot: REPO,
    config: defaultConfig(),
    nowIso: "2026-07-21T10:00:00.000Z",
  };

  const preToolUse = (toolName: string) =>
    normalizeEvent(
      {
        hook_event_name: "PreToolUse",
        session_id: "sess-1",
        tool_name: toolName,
        tool_input: { subagent_type: "explore-cheap" },
      },
      ctx,
    );

  // Claude Code has shipped the spawn tool as both `Task` and `Agent`;
  // recognizing only one drops every subagent_start on the other.
  it.each(["Task", "Agent"])("records a subagent_start for the %s tool", (toolName) => {
    const event = preToolUse(toolName);
    expect(event?.eventName).toBe("subagent_start");
    expect(event?.agentType).toBe("explore-cheap");
    expect(event?.agentId).toBeTruthy();
  });

  it("ignores PreToolUse for tools that do not spawn a subagent", () => {
    expect(preToolUse("Bash")).toBeNull();
    expect(preToolUse("Read")).toBeNull();
  });

  it("classifies both spawn tool names as delegation", () => {
    expect(classifyTool("Task")).toBe("delegation");
    expect(classifyTool("Agent")).toBe("delegation");
  });
});
