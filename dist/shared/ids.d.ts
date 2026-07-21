/** Generate a random UUID (v4). */
export declare function newId(): string;
/** Stable SHA-256 hex digest of a string. */
export declare function sha256Hex(input: string): string;
/** Short, stable identifier derived from a longer id, for compact display. */
export declare function shortId(id: string, length?: number): string;
