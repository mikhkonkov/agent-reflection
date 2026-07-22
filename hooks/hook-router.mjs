#!/usr/bin/env node
// The import is deferred and guarded: a static one crashes the process before
// any try/catch when dist/ is missing or a dependency is not installed (native
// better-sqlite3), which prints a module-resolution stack trace into the user's
// session on every hook. A telemetry problem must stay silent.

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  import("../dist/collector/hook-router.js")
    .then(({ runHook }) => runHook(data, process.cwd()))
    .catch(() => 0)
    .then(() => process.exit(0));
});
process.stdin.on("error", () => process.exit(0));
// Safety: if stdin never ends, exit 0 after a short delay.
setTimeout(() => process.exit(0), 5000).unref();
