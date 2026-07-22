---
name: agent-reflection-report
description: View and explain the latest Agent Reflection session report and its top recommendations.
---

# Agent Reflection Report

Use this skill to show the user their latest Agent Reflection session report and walk them through the top recommendations.

## Choosing which session to report on

The command takes a selector. Pick it from what the user asked for — the wrong
one silently reports on a different session:

| User asked for | Selector |
|---|---|
| "this session", "the session we're in", "so far" | `current` |
| "the last report", "the previous session", "the one that just ended" | `previous` |
| unclear, or no session mentioned | `latest` |

`current` is the session in progress; `previous` is the most recent session that
has ended; `latest` is whichever of the two started most recently.

If the resolved session looks too thin to be what the user meant (for example
`current` right after startup: a minute old, one or two tool calls), say so and
offer the other selector instead of presenting an empty report as the answer.

## Steps

1. Run the report command via Bash, with the selector chosen above:
   ```
   agent-reflection report current
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
- If the report command fails (for example, no sessions recorded yet, or no active session for `current`), report that plainly instead of guessing at contents.
