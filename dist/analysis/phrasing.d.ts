import type { ErrorCategory } from "../domain/event.js";
/** A human phrase for an error category, usable mid-sentence. */
export declare function describeErrorCategory(category: ErrorCategory): string;
/**
 * Render a file list for prose: up to `MAX_NAMED_FILES` backticked names, with
 * the remainder collapsed into a count. Empty input yields undefined so callers
 * can drop the clause entirely rather than print "in no files".
 */
export declare function formatFileList(paths: string[]): string | undefined;
/** "1 time" / "3 times". */
export declare function times(count: number): string;
/** "1 edit" / "8 edits". */
export declare function edits(count: number): string;
