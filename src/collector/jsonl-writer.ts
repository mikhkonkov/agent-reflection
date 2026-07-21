import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedEvent } from "../domain/event.js";
import { logger } from "../shared/logger.js";

/**
 * Append a NormalizedEvent as one JSON line to `<eventsDir>/<sessionId>.jsonl`.
 * Fail-safe: any error is logged and swallowed, never thrown.
 */
export function appendEvent(eventsDir: string, sessionId: string, event: NormalizedEvent): void {
  try {
    mkdirSync(eventsDir, { recursive: true });
    const filePath = join(eventsDir, `${sessionId}.jsonl`);
    appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch (error) {
    logger.warn("Failed to append event to JSONL log", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
