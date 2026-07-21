import type { SessionRepository } from "../storage/session-repository.js";
import type { SessionRecord } from "../domain/session.js";

export type SessionSelectorResult =
  | { kind: "found"; record: SessionRecord }
  | { kind: "not-found"; reason: string }
  | { kind: "ambiguous"; matches: SessionRecord[] };

/**
 * Shared "which session did the user mean" resolution for the `report` and
 * `label` commands: `current` (active), `previous` (last finished), `latest`
 * (newest regardless of status), or an exact id / id prefix.
 */
export function resolveSessionSelector(
  sessions: SessionRepository,
  repositoryHash: string,
  selector: string,
): SessionSelectorResult {
  if (selector === "latest" || selector === "current" || selector === "previous") {
    const record =
      selector === "current"
        ? sessions.latestActive(repositoryHash)
        : selector === "previous"
          ? sessions.latestCompleted(repositoryHash)
          : sessions.latest(repositoryHash);
    if (!record) {
      const reason =
        selector === "current"
          ? "No active session recorded for this repository."
          : selector === "previous"
            ? "No finished session recorded yet for this repository."
            : "No sessions recorded yet for this repository.";
      return { kind: "not-found", reason };
    }
    return { kind: "found", record };
  }

  const exact = sessions.get(selector);
  const matches = exact ? [exact] : sessions.findByShortPrefix(repositoryHash, selector);

  if (matches.length === 0) {
    return { kind: "not-found", reason: `No session found with id "${selector}".` };
  }
  if (matches.length > 1) {
    return { kind: "ambiguous", matches };
  }
  return { kind: "found", record: matches[0]! };
}
