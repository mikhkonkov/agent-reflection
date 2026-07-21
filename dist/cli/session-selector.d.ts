import type { SessionRepository } from "../storage/session-repository.js";
import type { SessionRecord } from "../domain/session.js";
export type SessionSelectorResult = {
    kind: "found";
    record: SessionRecord;
} | {
    kind: "not-found";
    reason: string;
} | {
    kind: "ambiguous";
    matches: SessionRecord[];
};
/**
 * Shared "which session did the user mean" resolution for the `report` and
 * `label` commands: `current` (active), `previous` (last finished), `latest`
 * (newest regardless of status), or an exact id / id prefix.
 */
export declare function resolveSessionSelector(sessions: SessionRepository, repositoryHash: string, selector: string): SessionSelectorResult;
