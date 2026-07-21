---
name: agent-auditor-report
description: View and explain the latest Agent Auditor session report and its top recommendations.
---

# Agent Auditor Report

Use this skill to show the user their latest Agent Auditor session report and walk them through the top recommendations.

## Steps

1. Run the report command via Bash:
   ```
   agent-auditor report latest
   ```
2. Read the generated report file (or the command's output, whichever contains the actual report content).
3. Explain the top recommendations concisely:
   - Summarize the overall session outcome and key metrics first.
   - List the top recommendations in priority order.
   - For each recommendation, state the reasoning in one or two sentences — avoid restating raw data the user can already see in the report.
4. Do not act on any recommendation automatically. If a recommendation implies launching a subagent, changing model routing, or modifying any policy or configuration file, ALWAYS ask the user for explicit confirmation before doing so.

## Rules

- Never launch a subagent as a side effect of running this skill.
- Never modify policy or configuration files as a side effect of running this skill.
- If `agent-auditor report latest` fails (for example, no sessions recorded yet), report that plainly instead of guessing at contents.
