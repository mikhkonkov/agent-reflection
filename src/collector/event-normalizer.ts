import type {
  CompactionTrigger,
  ErrorCategory,
  NormalizedEvent,
  PromptClass,
} from "../domain/event.js";
import { classifyTool } from "../domain/tool-classification.js";
import type { AuditorConfig } from "../config/config-schema.js";
import { newId, sha256Hex } from "../shared/ids.js";
import { redact, redactObject } from "./redactor.js";
import { extractRelativePaths } from "./path-sanitizer.js";
import { getNumber, getObject, getString, type RawHook } from "./hook-input-schema.js";

/** Normalization context passed alongside the raw hook payload. */
export interface NormalizeContext {
  sessionId: string;
  repoRoot: string;
  config: AuditorConfig;
  /** ISO-8601 timestamp, injected so normalization stays deterministic/testable. */
  nowIso: string;
}

/**
 * The minimal shape `categorizeError`/`isToolFailure` need from a PostToolUse
 * payload, named after the raw hook's own wire fields so test fixtures can be
 * passed through unmodified (or trivially subset from a full raw payload).
 */
export interface ToolResultPayload {
  tool_name?: string;
  tool_response?: unknown;
}

// ---------------------------------------------------------------------------
// classifyPrompt
// ---------------------------------------------------------------------------

/**
 * Priority order (most to least specific), chosen so that overlapping keyword
 * hits resolve deterministically:
 *   1. architecture — narrow, uncommon vocabulary (architect, migration, schema,
 *      concurren*, "refactor the ...").
 *   2. research      — fairly distinctive vocabulary (research, compare,
 *      investigate, docs, "how does X work").
 *   3. debugging     — specific problem-report vocabulary (error, bug, stack
 *      trace, throw, exception, "why is/does").
 *   4. discovery     — common but still fairly specific verbs (find, where,
 *      locate, search, list, show me, explore).
 *   5. implementation — broadest catch-all verbs (implement, add, create,
 *      build, write, refactor, fix); checked last since these words appear in
 *      almost any development request.
 * Falls back to "unknown" when nothing matches.
 */
const ARCHITECTURE_RE = /architect|design|migrate|migration|refactor the|restructure|schema|concurren/i;
const RESEARCH_RE = /research|compare|investigate|docs|documentation|how does .* work/i;
const DEBUGGING_RE = /error|fail|bug|stack trace|throw|exception|why (is|does)/i;
const DISCOVERY_RE = /find|where|locate|search|list|show me|explore/i;
const IMPLEMENTATION_RE = /implement|add|create|build|write|refactor|fix/i;

/** Classify a user prompt by keyword/shape heuristic only. Never uses an LLM. */
export function classifyPrompt(prompt: string): PromptClass {
  if (ARCHITECTURE_RE.test(prompt)) return "architecture";
  if (RESEARCH_RE.test(prompt)) return "research";
  if (DEBUGGING_RE.test(prompt)) return "debugging";
  if (DISCOVERY_RE.test(prompt)) return "discovery";
  if (IMPLEMENTATION_RE.test(prompt)) return "implementation";
  return "unknown";
}

// ---------------------------------------------------------------------------
// categorizeError / isToolFailure
// ---------------------------------------------------------------------------

const TEST_FAILURE_RE = /test|assert|expect|FAIL/;
const TYPE_ERROR_RE = /type error|ts\d{3,}|is not assignable/i;
const LINT_ERROR_RE = /eslint|lint|prettier/i;
const PERMISSION_DENIED_RE = /permission denied|EACCES|not permitted/i;
const FILE_NOT_FOUND_RE = /no such file|ENOENT|not found/i;
const TIMEOUT_RE = /timeout|timed out|ETIMEDOUT/i;
const NETWORK_RE = /ECONNREFUSED|network|ENOTFOUND|fetch failed/i;
const COMMAND_NON_ZERO_EXIT_RE = /exit code [1-9]|non-zero/i;

/** Indicators that a tool_response represents a failure. */
const ERROR_TEXT_RE = /error|failed|exit code [1-9]|ENOENT|EACCES|Traceback|not found/i;

/**
 * Best-effort text serialization of a tool_response for regex scanning. Never
 * throws; unsupported/circular shapes degrade to an empty string.
 */
function serializeForScan(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/**
 * True when tool_response indicates the tool call failed. Checks, in order:
 * an explicit `is_error === true`, presence of a non-null `error` field, or a
 * string/serialized-object match against a generic failure-text pattern (this
 * also covers a `stderr` string field, since it appears in the serialization).
 */
export function isToolFailure(payload: ToolResultPayload): boolean {
  const response = payload.tool_response;
  if (response === undefined || response === null) return false;

  if (typeof response === "object" && !Array.isArray(response)) {
    const obj = response as Record<string, unknown>;
    if (obj["is_error"] === true) return true;
    if (Object.prototype.hasOwnProperty.call(obj, "error") && obj["error"] !== null && obj["error"] !== undefined) {
      return true;
    }
  }

  return ERROR_TEXT_RE.test(serializeForScan(response));
}

/** Categorize a tool failure by inspecting tool_name and tool_response text. */
export function categorizeError(payload: ToolResultPayload): ErrorCategory {
  const toolName = payload.tool_name ?? "";
  const text = `${toolName} ${serializeForScan(payload.tool_response)}`;

  if (TEST_FAILURE_RE.test(text)) return "test_failure";
  if (TYPE_ERROR_RE.test(text)) return "type_error";
  if (LINT_ERROR_RE.test(text)) return "lint_error";
  if (PERMISSION_DENIED_RE.test(text)) return "permission_denied";
  if (FILE_NOT_FOUND_RE.test(text)) return "file_not_found";
  if (TIMEOUT_RE.test(text)) return "timeout";
  if (NETWORK_RE.test(text)) return "network";
  if (COMMAND_NON_ZERO_EXIT_RE.test(text)) return "command_non_zero_exit";
  return "unknown";
}

// ---------------------------------------------------------------------------
// hashPrompt
// ---------------------------------------------------------------------------

/** Stable, irreversible hash of prompt text — used instead of storing text. */
export function hashPrompt(prompt: string): string {
  return sha256Hex(prompt);
}

// ---------------------------------------------------------------------------
// normalizeEvent
// ---------------------------------------------------------------------------

function toolResultPayload(raw: RawHook): ToolResultPayload {
  const record = raw as unknown as Record<string, unknown>;
  return {
    tool_name: getString(record, "tool_name"),
    tool_response: record["tool_response"],
  };
}

function agentIdFrom(record: Record<string, unknown>): string | undefined {
  return getString(record, "agent_id") ?? getString(record, "subagent_id");
}

/**
 * Map a validated raw hook payload to a NormalizedEvent, or null when the event
 * carries no telemetry we record (e.g. PreToolUse for a non-Task tool).
 */
export function normalizeEvent(raw: RawHook, ctx: NormalizeContext): NormalizedEvent | null {
  const record = raw as unknown as Record<string, unknown>;
  const occurredAt = ctx.nowIso;

  switch (raw.hook_event_name) {
    case "SessionStart": {
      const source = getString(record, "source");
      const model = getString(record, "model");
      const metadata: Record<string, unknown> = {};
      if (source !== undefined) metadata.source = source;
      if (model !== undefined) metadata.mainModel = model;
      return {
        sessionId: ctx.sessionId,
        eventName: "session_start",
        occurredAt,
        metadata,
      };
    }

    case "UserPromptSubmit": {
      const prompt = getString(record, "prompt") ?? "";
      const metadata: Record<string, unknown> = {
        promptHash: hashPrompt(prompt),
        promptClass: classifyPrompt(prompt),
      };
      if (ctx.config.privacy.storePromptText) {
        metadata.promptText = redact(prompt);
      }
      return {
        sessionId: ctx.sessionId,
        eventName: "user_prompt",
        occurredAt,
        inputSize: prompt.length,
        metadata,
      };
    }

    case "PreToolUse": {
      const toolName = getString(record, "tool_name");
      if (toolName !== "Task") return null;
      const toolInput = getObject(record, "tool_input");
      const agentType = toolInput ? getString(toolInput, "subagent_type") : undefined;
      const agentId = newId();
      const metadata: Record<string, unknown> = {};
      if (agentType !== undefined) metadata.agentType = agentType;
      return {
        sessionId: ctx.sessionId,
        eventName: "subagent_start",
        occurredAt,
        agentId,
        agentType,
        metadata,
      };
    }

    case "PostToolUse": {
      const toolName = getString(record, "tool_name");
      const toolInput = record["tool_input"];
      const failure = isToolFailure(toolResultPayload(raw));
      const metadata: Record<string, unknown> = {};
      if (ctx.config.privacy.storeToolOutput) {
        metadata.toolOutput = redact(serializeForScan(record["tool_response"]));
      }
      if (ctx.config.privacy.storeRawPayloads) {
        metadata.raw = redactObject(record);
      }
      const relativePaths = extractRelativePaths(toolInput, ctx.repoRoot);
      return {
        sessionId: ctx.sessionId,
        eventName: failure ? "post_tool_use_failure" : "post_tool_use",
        occurredAt,
        toolName,
        toolClassification: classifyTool(toolName, ctx.config.toolClassifications),
        success: !failure,
        agentId: agentIdFrom(record),
        durationMs: getNumber(record, "duration_ms"),
        inputSize: serializeForScan(toolInput).length,
        outputSize: serializeForScan(record["tool_response"]).length,
        relativePaths,
        pathCount: relativePaths.length,
        errorCategory: failure ? categorizeError(toolResultPayload(raw)) : undefined,
        metadata,
      };
    }

    case "SubagentStop": {
      const status = getString(record, "status");
      const metadata: Record<string, unknown> = {};
      if (status !== undefined) metadata.status = status;
      return {
        sessionId: ctx.sessionId,
        eventName: "subagent_stop",
        occurredAt,
        agentId: agentIdFrom(record),
        metadata,
      };
    }

    case "PreCompact": {
      const trigger = getString(record, "trigger");
      const compactionTrigger: CompactionTrigger =
        trigger === "manual" ? "manual" : trigger === "auto" ? "auto" : "unknown";
      return {
        sessionId: ctx.sessionId,
        eventName: "pre_compact",
        occurredAt,
        compactionTrigger,
        metadata: {},
      };
    }

    case "SessionEnd": {
      const reason = getString(record, "reason");
      const metadata: Record<string, unknown> = {};
      if (reason !== undefined) metadata.reason = reason;
      return {
        sessionId: ctx.sessionId,
        eventName: "session_end",
        occurredAt,
        metadata,
      };
    }

    default:
      return null;
  }
}

