/**
 * Local-only diagnostic logger. Never throws, never touches the network.
 * Writes to stderr so it never pollutes hook stdout contracts.
 * Set AGENT_AUDITOR_DEBUG=1 to enable debug output.
 */
const DEBUG = process.env.AGENT_AUDITOR_DEBUG === "1";
function safeWrite(line) {
    try {
        process.stderr.write(`${line}\n`);
    }
    catch {
        /* never throw from the logger */
    }
}
export const logger = {
    debug(message, meta) {
        if (!DEBUG)
            return;
        safeWrite(formatLine("debug", message, meta));
    },
    warn(message, meta) {
        safeWrite(formatLine("warn", message, meta));
    },
    error(message, meta) {
        safeWrite(formatLine("error", message, meta));
    },
};
function formatLine(level, message, meta) {
    const base = `[agent-auditor:${level}] ${message}`;
    if (!meta)
        return base;
    try {
        return `${base} ${JSON.stringify(meta)}`;
    }
    catch {
        return base;
    }
}
//# sourceMappingURL=logger.js.map