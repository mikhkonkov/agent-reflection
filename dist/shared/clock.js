export const systemClock = {
    nowIso: () => new Date().toISOString(),
    nowMs: () => Date.now(),
};
/** A fixed clock for tests. */
export function fixedClock(iso) {
    const ms = new Date(iso).getTime();
    return {
        nowIso: () => iso,
        nowMs: () => ms,
    };
}
//# sourceMappingURL=clock.js.map