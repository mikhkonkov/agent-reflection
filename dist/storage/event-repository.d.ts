import type { DatabaseHandle } from "./database.js";
import type { NormalizedEvent } from "../domain/event.js";
/** Repository for reading and writing `events` rows. */
export declare class EventRepository {
    private readonly db;
    constructor(db: DatabaseHandle);
    private rowToEvent;
    insert(event: NormalizedEvent): void;
    listBySession(sessionId: string): NormalizedEvent[];
    countBySession(sessionId: string): number;
}
