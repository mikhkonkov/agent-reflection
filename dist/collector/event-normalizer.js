import { classifyTool, isDelegationTool } from "../domain/tool-classification.js";
import { PENDING_SUBAGENT_PREFIX } from "../domain/subagent.js";
import { newId, sha256Hex } from "../shared/ids.js";
import { redact, redactObject } from "./redactor.js";
import { extractRelativePaths } from "./path-sanitizer.js";
import { asRecord, getNumber, getObject, getString } from "./hook-input-schema.js";
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
export function classifyPrompt(prompt) {
    if (ARCHITECTURE_RE.test(prompt))
        return "architecture";
    if (RESEARCH_RE.test(prompt))
        return "research";
    if (DEBUGGING_RE.test(prompt))
        return "debugging";
    if (DISCOVERY_RE.test(prompt))
        return "discovery";
    if (IMPLEMENTATION_RE.test(prompt))
        return "implementation";
    return "unknown";
}
// ---------------------------------------------------------------------------
// categorizeError / isToolFailure
// ---------------------------------------------------------------------------
/**
 * Deliberately narrow: it must match runner OUTPUT, not an incidental mention
 * of the word "test". A bare /test/ matched every failure whose message merely
 * contained a path like `tests/foo.ts`, so unrelated Read/Edit errors were all
 * filed as test failures.
 */
const TEST_FAILURE_RE = /\b\d+\s+(?:tests?|specs?|examples?)\s+(?:failed|failing)\b|\btests?:?\s+(?:\d+\s+)?failed\b|\bFAIL\s+\S|\bAssertionError\b|\bassertion\s+failed\b|\bexpected\b[\s\S]{0,80}\breceived\b/i;
const TYPE_ERROR_RE = /type error|ts\d{3,}|is not assignable/i;
const LINT_ERROR_RE = /eslint|lint|prettier/i;
const PERMISSION_DENIED_RE = /permission denied|EACCES|not permitted/i;
const FILE_NOT_FOUND_RE = /no such file|ENOENT|not found/i;
const TIMEOUT_RE = /timeout|timed out|ETIMEDOUT/i;
const NETWORK_RE = /ECONNREFUSED|network|ENOTFOUND|fetch failed/i;
const COMMAND_NON_ZERO_EXIT_RE = /exit code [1-9]|non-zero/i;
/**
 * Failure markers, anchored to the START of the response (or of one of its
 * lines). Anchoring is the whole point: an unanchored scan flagged every call
 * whose OUTPUT merely contained the word "error" — reading a source file named
 * `error-category.ts`, or grepping for "error", counted as a failed tool call
 * and inflated the failure rate several-fold.
 */
const FAILURE_PREFIX_RE = /^\s*(?:exit code [1-9]|error\b|errno\b|ENOENT|EACCES|ETIMEDOUT|ECONNREFUSED|Traceback \(most recent call last\)|fatal:|Permission denied|command not found|No such file)/im;
/** Phrases Claude Code itself returns in place of a tool result. */
const REJECTED_RE = /^\s*(?:The user (?:doesn't want|does not want|rejected)|User rejected|Tool use was rejected|The tool use was rejected)/i;
/** File-tool refusals, which arrive as a plain sentence rather than an error object. */
const FILE_TOOL_ERROR_RE = /^\s*(?:File (?:does not exist|has not been read yet)|0 lines? read|String to replace not found|Found \d+ matches of the string to replace)/i;
/**
 * Best-effort text serialization of a tool_response for regex scanning. Never
 * throws; unsupported/circular shapes degrade to an empty string.
 */
function serializeForScan(value) {
    if (value === undefined || value === null)
        return "";
    if (typeof value === "string")
        return value;
    try {
        return JSON.stringify(value) ?? "";
    }
    catch {
        return "";
    }
}
/**
 * True when tool_response indicates the tool call failed.
 *
 * Ordered from authoritative to heuristic:
 *   1. `is_error === true` — the tool result's own flag.
 *   2. a non-null `error` field.
 *   3. `interrupted === true` — an aborted/timed-out execution.
 *   4. a failure marker at the start of the response text, or at the start of
 *      a `stderr` line. Never a free-text scan of the whole output: successful
 *      output routinely contains the words "error" and "failed".
 */
export function isToolFailure(payload) {
    const response = payload.tool_response;
    if (response === undefined || response === null)
        return false;
    if (typeof response === "string") {
        return (REJECTED_RE.test(response) ||
            FILE_TOOL_ERROR_RE.test(response) ||
            FAILURE_PREFIX_RE.test(response));
    }
    if (typeof response === "object" && !Array.isArray(response)) {
        const obj = response;
        if (obj["is_error"] === true)
            return true;
        if (Object.prototype.hasOwnProperty.call(obj, "error") &&
            obj["error"] !== null &&
            obj["error"] !== undefined) {
            return true;
        }
        if (obj["isError"] === true)
            return true;
        if (obj["interrupted"] === true)
            return true;
        // MCP-shaped results: { content: [{ type: "text", text: "..." }] }.
        const content = obj["content"];
        if (Array.isArray(content)) {
            const text = content
                .map((block) => {
                const record = asRecord(block);
                return record !== undefined && typeof record["text"] === "string" ? record["text"] : "";
            })
                .join("\n");
            if (text !== "" && FAILURE_PREFIX_RE.test(text))
                return true;
        }
        const stdout = typeof obj["stdout"] === "string" ? obj["stdout"] : "";
        const stderr = typeof obj["stderr"] === "string" ? obj["stderr"] : "";
        // Bash surfaces a non-zero exit as an "Exit code N" prefix on the result;
        // stderr alone is not a failure signal, since many tools log to it while
        // succeeding (progress bars, deprecation notices).
        return FAILURE_PREFIX_RE.test(stdout) || FAILURE_PREFIX_RE.test(stderr);
    }
    return false;
}
/** Categorize a tool failure by inspecting tool_name and tool_response text. */
export function categorizeError(payload) {
    const toolName = payload.tool_name ?? "";
    const text = `${toolName} ${serializeForScan(payload.tool_response)}`;
    if (TEST_FAILURE_RE.test(text))
        return "test_failure";
    if (TYPE_ERROR_RE.test(text))
        return "type_error";
    if (LINT_ERROR_RE.test(text))
        return "lint_error";
    if (PERMISSION_DENIED_RE.test(text))
        return "permission_denied";
    if (FILE_NOT_FOUND_RE.test(text))
        return "file_not_found";
    if (TIMEOUT_RE.test(text))
        return "timeout";
    if (NETWORK_RE.test(text))
        return "network";
    if (COMMAND_NON_ZERO_EXIT_RE.test(text))
        return "command_non_zero_exit";
    return "unknown";
}
// ---------------------------------------------------------------------------
// hashPrompt
// ---------------------------------------------------------------------------
/** Stable, irreversible hash of prompt text — used instead of storing text. */
export function hashPrompt(prompt) {
    return sha256Hex(prompt);
}
// ---------------------------------------------------------------------------
// normalizeEvent
// ---------------------------------------------------------------------------
function toolResultPayload(raw) {
    const record = raw;
    return {
        tool_name: getString(record, "tool_name"),
        tool_response: record["tool_response"],
    };
}
function agentIdFrom(record) {
    return getString(record, "agent_id") ?? getString(record, "subagent_id");
}
/**
 * Map a validated raw hook payload to a NormalizedEvent, or null when the event
 * carries no telemetry we record (e.g. PreToolUse for a non-delegation tool).
 */
export function normalizeEvent(raw, ctx) {
    const record = raw;
    const occurredAt = ctx.nowIso;
    switch (raw.hook_event_name) {
        case "SessionStart": {
            const source = getString(record, "source");
            const model = getString(record, "model");
            const metadata = {};
            if (source !== undefined)
                metadata.source = source;
            if (model !== undefined)
                metadata.mainModel = model;
            return {
                sessionId: ctx.sessionId,
                eventName: "session_start",
                occurredAt,
                metadata,
            };
        }
        case "UserPromptSubmit": {
            const prompt = getString(record, "prompt") ?? "";
            const metadata = {
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
            if (!isDelegationTool(toolName))
                return null;
            const toolInput = getObject(record, "tool_input");
            const agentType = toolInput ? getString(toolInput, "subagent_type") : undefined;
            // The launching PreToolUse carries no agent id — it runs in the main
            // agent's context. Mint a placeholder; the collector rebinds it to the
            // real `agent_id` once the subagent emits its first event.
            const agentId = `${PENDING_SUBAGENT_PREFIX}${newId()}`;
            const metadata = {};
            if (agentType !== undefined)
                metadata.agentType = agentType;
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
            const metadata = {};
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
            const metadata = {};
            if (status !== undefined)
                metadata.status = status;
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
            const compactionTrigger = trigger === "manual" ? "manual" : trigger === "auto" ? "auto" : "unknown";
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
            const metadata = {};
            if (reason !== undefined)
                metadata.reason = reason;
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
//# sourceMappingURL=event-normalizer.js.map