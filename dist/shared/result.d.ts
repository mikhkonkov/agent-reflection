/**
 * Minimal Result type for fail-safe pipelines.
 * Hooks must never throw upward; they return a Result and degrade gracefully.
 */
export type Result<T, E = Error> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: E;
};
export declare function ok<T>(value: T): Result<T, never>;
export declare function err<E>(error: E): Result<never, E>;
export declare function isOk<T, E>(result: Result<T, E>): result is {
    ok: true;
    value: T;
};
export declare function isErr<T, E>(result: Result<T, E>): result is {
    ok: false;
    error: E;
};
/** Run a function, capturing any thrown error into a Result. */
export declare function tryCatch<T>(fn: () => T): Result<T, Error>;
