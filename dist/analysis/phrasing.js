/** How many file names a recommendation names inline before summarizing. */
const MAX_NAMED_FILES = 3;
/** A human phrase for an error category, usable mid-sentence. */
export function describeErrorCategory(category) {
    switch (category) {
        case "test_failure":
            return "failing tests";
        case "command_non_zero_exit":
            return "a command exiting non-zero";
        case "permission_denied":
            return "permission errors";
        case "file_not_found":
            return "missing files";
        case "type_error":
            return "type errors";
        case "lint_error":
            return "lint errors";
        case "timeout":
            return "timeouts";
        case "network":
            return "network errors";
        case "unknown":
            return "the same unclassified error";
    }
}
/**
 * Render a file list for prose: up to `MAX_NAMED_FILES` backticked names, with
 * the remainder collapsed into a count. Empty input yields undefined so callers
 * can drop the clause entirely rather than print "in no files".
 */
export function formatFileList(paths) {
    if (paths.length === 0)
        return undefined;
    const named = paths.slice(0, MAX_NAMED_FILES).map((path) => `\`${path}\``);
    const remaining = paths.length - named.length;
    if (remaining > 0)
        named.push(`+${remaining} more`);
    return named.join(", ");
}
/** "1 time" / "3 times". */
export function times(count) {
    return count === 1 ? "1 time" : `${count} times`;
}
/** "1 edit" / "8 edits". */
export function edits(count) {
    return count === 1 ? "1 edit" : `${count} edits`;
}
//# sourceMappingURL=phrasing.js.map