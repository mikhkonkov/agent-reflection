#!/bin/bash
# agent-auditor — statusline context meter for Claude Code.
#
# Renders a traffic-light bar for how full the context window is, plus the
# tokens spent in this session:
#
#   [███░░░░░░░] 32% 65K · ↻ 521K
#
# Claude Code plugins cannot register a main statusLine, so this one is opt-in:
# run `make install-statusline` (or `bash statusline/install.sh`). The subagent
# rows are handled separately by subagent-statusline.sh, which the plugin does
# install automatically.
#
# Env:
#   AGENT_AUDITOR_STATUSLINE_CHAIN
#       another statusline command to render first; it receives the same stdin
#       JSON and its output is prefixed to the meter (keeps an existing badge)
#   CLAUDE_CONTEXT_LIMIT
#       context window size in tokens; only used for the transcript fallback
#       below, since Claude Code normally reports the real size on stdin
#
# Pure bash + awk on purpose: the statusline re-renders constantly, and a node
# or python start-up (60ms / 27ms on a Mac laptop) is visible latency; awk is ~8ms.

export LC_ALL="${LC_ALL:-en_US.UTF-8}"

INPUT=$(cat)

# ------------------------------------------------------------- chained prefix
# The chained command gets the same stdin. Its output is rendered into the
# terminal on every refresh, so cap the length and strip control bytes — but
# keep ESC (\033) so colour sequences survive.
PREFIX=""
if [ -n "$AGENT_AUDITOR_STATUSLINE_CHAIN" ]; then
  PREFIX=$(printf '%s' "$INPUT" | eval "$AGENT_AUDITOR_STATUSLINE_CHAIN" 2>/dev/null \
    | head -1 | head -c 256 | tr -d '\000-\010\012-\032\034-\037')
fi

emit() {
  [ -n "$PREFIX" ] && printf '%s' "$PREFIX"
  [ -n "$PREFIX" ] && [ -n "$1" ] && printf ' '
  [ -n "$1" ] && printf '%s' "$1"
  printf '\n'
}

# shellcheck source=meter.sh
. "$(dirname "${BASH_SOURCE[0]}")/meter.sh"

# ------------------------------------------------------------------- readings
# Claude Code reports the context window directly (statusline stdin, see
# `context_window` in the docs). That is authoritative — it matches /context —
# so prefer it and only fall back to reading the transcript on older versions.
CW=$(jscope context_window)
USED=$(jnum used_percentage "$CW")
SIZE=$(jnum context_window_size "$CW")
IN=$(jnum total_input_tokens "$CW")
OUT=$(jnum total_output_tokens "$CW")

if [ -n "$SIZE" ] && [ "$SIZE" -gt 0 ] 2>/dev/null; then
  PCT=${USED%%.*}
  [ -z "$PCT" ] && PCT=0
  CTX=$(( SIZE * PCT / 100 ))
  TOTAL=$(( ${IN:-0} + ${OUT:-0} ))
else
  TRANSCRIPT=$(jstr transcript_path)
  [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ] && { emit ""; exit 0; }
  read -r CTX TOTAL <<<"$(scan_transcript "$TRANSCRIPT")"
  [ -z "$CTX" ] || [ "$CTX" -le 0 ] && { emit ""; exit 0; }
  LIMIT="${CLAUDE_CONTEXT_LIMIT:-200000}"
  PCT=$(( CTX * 100 / LIMIT ))
fi

[ "$PCT" -gt 100 ] && PCT=100

emit "$(render_meter "$PCT" "$CTX" "$TOTAL")"
