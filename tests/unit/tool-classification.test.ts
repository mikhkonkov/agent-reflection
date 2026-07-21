import { describe, it, expect } from "vitest";
import { classifyTool } from "../../src/domain/tool-classification.js";

describe("classifyTool", () => {
  it("classifies built-in tools by the default map", () => {
    expect(classifyTool("Read")).toBe("discovery");
    expect(classifyTool("Grep")).toBe("discovery");
    expect(classifyTool("Glob")).toBe("discovery");
    expect(classifyTool("Edit")).toBe("modification");
    expect(classifyTool("Write")).toBe("modification");
    expect(classifyTool("Bash")).toBe("execution");
    expect(classifyTool("Task")).toBe("delegation");
  });

  it("returns undefined for a missing tool name", () => {
    expect(classifyTool(undefined)).toBeUndefined();
  });

  it("classifies unknown built-in tools as other", () => {
    expect(classifyTool("SomethingElse")).toBe("other");
  });

  it("classifies MCP research-like tools as external_research", () => {
    expect(classifyTool("mcp__server__web_search")).toBe("external_research");
    expect(classifyTool("mcp__docs__fetch")).toBe("external_research");
    expect(classifyTool("mcp__x__browse_page")).toBe("external_research");
    expect(classifyTool("mcp__x__get_docs")).toBe("external_research");
    expect(classifyTool("mcp__x__deep_research")).toBe("external_research");
  });

  it("classifies other MCP tools as other", () => {
    expect(classifyTool("mcp__server__create_ticket")).toBe("other");
  });

  it("applies config overrides over the defaults", () => {
    expect(classifyTool("Bash", { Bash: "modification" })).toBe("modification");
    expect(classifyTool("CustomTool", { CustomTool: "discovery" })).toBe("discovery");
  });
});
