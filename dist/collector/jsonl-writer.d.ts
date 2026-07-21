import type { NormalizedEvent } from "../domain/event.js";
/**
 * Append a NormalizedEvent as one JSON line to `<eventsDir>/<sessionId>.jsonl`.
 * Fail-safe: any error is logged and swallowed, never thrown.
 */
export declare function appendEvent(eventsDir: string, sessionId: string, event: NormalizedEvent): void;
