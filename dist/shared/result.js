export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function isOk(result) {
    return result.ok;
}
export function isErr(result) {
    return !result.ok;
}
/** Run a function, capturing any thrown error into a Result. */
export function tryCatch(fn) {
    try {
        return ok(fn());
    }
    catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)));
    }
}
//# sourceMappingURL=result.js.map