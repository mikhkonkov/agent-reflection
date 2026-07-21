/**
 * Best-effort secret redaction. Applied to any text that might reach storage
 * under privacy opt-ins (raw payloads, tool output, prompt text). Never a
 * substitute for not storing the data in the first place — the default config
 * stores none of it.
 */
/** Replace likely secrets in `text` with `[REDACTED]`. */
export declare function redact(text: string): string;
/** True when `text` contains something that looks like a secret. */
export declare function containsSecret(text: string): boolean;
/**
 * Deep-walk an arbitrary value, applying `redact` to every string found.
 * Used only when raw payload storage is explicitly enabled via config.
 */
export declare function redactObject(value: unknown): unknown;
