import { randomUUID, createHash } from "node:crypto";

/** Generate a random UUID (v4). */
export function newId(): string {
  return randomUUID();
}

/** Stable SHA-256 hex digest of a string. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Short, stable identifier derived from a longer id, for compact display. */
export function shortId(id: string, length = 8): string {
  return id.replace(/-/g, "").slice(0, length);
}
