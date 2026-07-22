/**
 * Local-only diagnostic logger. Never throws, never touches the network.
 * Writes to stderr so it never pollutes hook stdout contracts.
 * Set AGENT_REFLECTION_DEBUG=1 to enable debug output.
 */
const DEBUG = process.env.AGENT_REFLECTION_DEBUG === "1";

function safeWrite(line: string): void {
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    /* never throw from the logger */
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!DEBUG) return;
    safeWrite(formatLine("debug", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    safeWrite(formatLine("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>): void {
    safeWrite(formatLine("error", message, meta));
  },
};

function formatLine(level: string, message: string, meta?: Record<string, unknown>): string {
  const base = `[agent-reflection:${level}] ${message}`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}
