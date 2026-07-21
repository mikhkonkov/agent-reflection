---
name: agent-auditor-label
description: Label the outcome of the latest Agent Auditor session (accepted / rework / failed).
---

# Agent Auditor Label

Use this skill to record an outcome label for the latest Agent Auditor session.

## Steps

1. Ask the user which outcome applies to the latest session. The valid values are:
   - `accepted`
   - `rework`
   - `failed`

   Do not infer or guess the outcome on the user's behalf — always ask first and wait for their answer.

2. Once the user has chosen a value, run the label command via Bash with that exact value:
   ```
   agent-auditor label <value>
   ```
   Replace `<value>` with the user's chosen outcome (`accepted`, `rework`, or `failed`).

3. Report the regenerated report path back to the user, using the command's output. If the command fails, report the failure plainly instead of guessing at the result.

## Rules

- Never choose or default the outcome value yourself.
- Never run the label command before the user has explicitly confirmed the outcome.
