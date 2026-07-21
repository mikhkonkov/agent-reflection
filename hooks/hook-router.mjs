#!/usr/bin/env node
import { runHook } from "../dist/collector/hook-router.js";

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let code = 0;
  try {
    code = runHook(data, process.cwd());
  } catch {
    code = 0;
  }
  process.exit(typeof code === "number" ? 0 : 0);
});
process.stdin.on("error", () => process.exit(0));
// Safety: if stdin never ends, exit 0 after a short delay.
setTimeout(() => process.exit(0), 5000).unref();
