/**
 * Best-effort secret redaction. Applied to any text that might reach storage
 * under privacy opt-ins (raw payloads, tool output, prompt text). Never a
 * substitute for not storing the data in the first place — the default config
 * stores none of it.
 */
const ANTHROPIC_KEY_RE = /sk-ant-[A-Za-z0-9_-]+/g;
const GENERIC_SK_KEY_RE = /sk-[A-Za-z0-9]{16,}/g;
const NAMED_SECRET_ASSIGNMENT_RE = /(ANTHROPIC_API_KEY|OPENAI_API_KEY|[A-Z0-9_]*API[_-]?KEY|[A-Z0-9_]*TOKEN|[A-Z0-9_]*SECRET|PASSWORD)\s*[:=]\s*\S+/gi;
const BEARER_TOKEN_RE = /Authorization:\s*Bearer\s+\S+/gi;
const PEM_BLOCK_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const PASSWORD_ASSIGNMENT_RE = /password\s*[:=]\s*\S+/gi;
const REDACTION_PATTERNS = [
    PEM_BLOCK_RE,
    ANTHROPIC_KEY_RE,
    GENERIC_SK_KEY_RE,
    BEARER_TOKEN_RE,
    NAMED_SECRET_ASSIGNMENT_RE,
    PASSWORD_ASSIGNMENT_RE,
];
const REDACTED = "[REDACTED]";
/** Replace likely secrets in `text` with `[REDACTED]`. */
export function redact(text) {
    let result = text;
    for (const pattern of REDACTION_PATTERNS) {
        result = result.replace(pattern, REDACTED);
    }
    return result;
}
/** True when `text` contains something that looks like a secret. */
export function containsSecret(text) {
    return REDACTION_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(text);
    });
}
/**
 * Deep-walk an arbitrary value, applying `redact` to every string found.
 * Used only when raw payload storage is explicitly enabled via config.
 */
export function redactObject(value) {
    if (typeof value === "string")
        return redact(value);
    if (Array.isArray(value))
        return value.map((item) => redactObject(item));
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value).map(([key, val]) => [key, redactObject(val)]);
        return Object.fromEntries(entries);
    }
    return value;
}
//# sourceMappingURL=redactor.js.map