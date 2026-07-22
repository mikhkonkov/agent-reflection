#!/bin/bash
# agent-reflection — subagent row body for Claude Code's agent panel.
#
# Unlike the main statusLine, `subagentStatusLine` can be shipped by a plugin
# (plugin-root settings.json), so this activates on install with no user setup.
#
# Claude Code passes every live task on stdin, each with its own `tokenCount`
# and `contextWindowSize`, so each row shows that subagent's own fill — the
# same traffic light as the main meter, scoped to the agent:
#
#   explore-cheap [██░░░░░░░░] 18% 36K · locating the auth middleware
#
# Output contract: one JSON line per row we override, `{"id":…,"content":…}`.
# Anything else on stdout is discarded and the row keeps its default rendering,
# so the row body must be JSON-escaped, ESC bytes included. Tasks we skip are
# simply not emitted, which leaves their default row intact.

export LC_ALL="${LC_ALL:-en_US.UTF-8}"

INPUT=$(cat)

# shellcheck source=meter.sh
. "$(dirname "${BASH_SOURCE[0]}")/meter.sh"

DEFAULT_LIMIT="${CLAUDE_CONTEXT_LIMIT:-200000}"
DIM='\033[38;5;244m'
RESET='\033[0m'

# Split the tasks array into one object per line. Nested objects inside a task
# (tokenSamples) mean a naive "},{" split is wrong, so track brace depth.
printf '%s' "$INPUT" | awk '
  {
    p = index($0, "\"tasks\":[")
    if (p == 0) exit
    s = substr($0, p + 9)
    depth = 0; start = 0
    for (i = 1; i <= length(s); i++) {
      c = substr(s, i, 1)
      if (c == "{") { if (depth == 0) start = i; depth++ }
      else if (c == "}") {
        depth--
        if (depth == 0) print substr(s, start, i - start + 1)
      }
      else if (c == "]" && depth == 0) exit
    }
  }
' | while IFS= read -r task; do
  status=$(jstr status "$task")
  [ "$status" = "running" ] || continue

  # Without an id Claude Code cannot match the row, so leave it to the default.
  id=$(jstr id "$task")
  [ -z "$id" ] && continue

  # Rendered into the terminal on every refresh: cap length, keep a safe class.
  # `name` is the FleetView nickname and is empty for a plain Task. The payload
  # carries no agent type at all (`type` is the task *kind* — local_agent,
  # local_bash …), so fall back to the model rather than printing that.
  name=$(jstr name "$task" | tr -cd 'A-Za-z0-9:._ -' | cut -c1-24)
  [ -z "$name" ] && name=$(jstr model "$task" | sed 's/^claude-//; s/-[0-9]\{6,\}$//' | tr -cd 'A-Za-z0-9._-' | cut -c1-24)
  [ -z "$name" ] && name="agent"

  # `label` is the live progress summary, already falling back to description.
  desc=$(jstr label "$task" | tr -cd 'A-Za-z0-9:._,() -' | cut -c1-48)
  [ -z "$desc" ] && desc=$(jstr description "$task" | tr -cd 'A-Za-z0-9:._,() -' | cut -c1-48)

  tokens=$(jnum tokenCount "$task")
  limit=$(jnum contextWindowSize "$task")
  [ -z "$limit" ] || [ "$limit" -le 0 ] 2>/dev/null && limit=$DEFAULT_LIMIT

  if [ -n "$tokens" ] && [ "$tokens" -gt 0 ] 2>/dev/null; then
    pct=$(( tokens * 100 / limit ))
    [ "$pct" -gt 100 ] && pct=100
    body="$name $(render_meter "$pct" "$tokens")"
  else
    # Task just started — no usage reported yet.
    body=$(printf '%b%s starting…%b' "$DIM" "$name" "$RESET")
  fi

  [ -n "$desc" ] && body="$body$(printf '%b · %s%b' "$DIM" "$desc" "$RESET")"

  printf '{"id":"%s","content":"%s"}\n' "$(json_escape "$id")" "$(json_escape "$body")"
done
