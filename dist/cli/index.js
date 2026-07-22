#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./init-command.js";
import { registerReportCommand } from "./report-command.js";
import { registerSessionsCommand } from "./sessions-command.js";
import { registerStatsCommand } from "./stats-command.js";
import { registerConfigCommand } from "./config-command.js";
const program = new Command();
program
    .name("agent-reflection")
    .description("Local-first session auditing and agent workflow recommendations for Claude Code")
    .version("0.1.1");
registerInitCommand(program);
registerReportCommand(program);
registerSessionsCommand(program);
registerStatsCommand(program);
registerConfigCommand(program);
try {
    await program.parseAsync(process.argv);
}
catch (error) {
    process.stderr.write(`agent-reflection: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}
//# sourceMappingURL=index.js.map