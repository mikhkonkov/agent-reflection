#!/bin/bash
# agent-auditor — shared rendering helpers for the statusline scripts.
# Sourced by context-statusline.sh and subagent-statusline.sh; not executable
# on its own. Expects the statusline stdin JSON in $INPUT.

CELLS="${AGENT_AUDITOR_METER_CELLS:-10}"

# --------------------------------------------------------------- JSON reading
# Deliberately regex-based rather than jq/node: these run on every refresh tick,
# and an interpreter start-up costs more than the whole render.

# jscope <key> — the slice of $INPUT that starts at an object-valued key, so
# that field names duplicated elsewhere in the payload cannot be picked up by
# accident (`used_percentage` exists under both context_window and rate_limits).
jscope() {
  printf '%s' "$INPUT" | awk -v key="\"$1\":{" '
    { p = index($0, key); if (p) printf "%s", substr($0, p + length(key), 600) }
  '
}

# jnum <key> [haystack] — first numeric value for a key; empty when absent.
jnum() {
  printf '%s' "${2-$INPUT}" | grep -o "\"$1\":[0-9]*\.\?[0-9]*" | head -1 | cut -d: -f2
}

# jstr <key> [haystack] — first string value for a key; empty when absent.
jstr() {
  printf '%s' "${2-$INPUT}" | grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

# ------------------------------------------------------------------ rendering
human() {
  awk -v n="$1" 'BEGIN {
    if (n >= 1000000) printf "%.1fM", n / 1000000
    else if (n >= 1000) printf "%dK", int(n / 1000 + 0.5)
    else printf "%d", n
  }'
}

build_bar() {
  local full="$1" empty="$2" filled="$3" out="" i=0
  while [ "$i" -lt "$CELLS" ]; do
    if [ "$i" -lt "$filled" ]; then out="$out$full"; else out="$out$empty"; fi
    i=$(( i + 1 ))
  done
  printf '%s' "$out"
}

# render_meter <pct> <context_tokens> [total_tokens]
# Traffic light: green below 60% of the window, amber to 85%, red above — the
# band where compaction becomes likely and work should be handed to a subagent.
render_meter() {
  local pct="$1" ctx="$2" total="${3:-}" color bar filled

  if   [ "$pct" -lt 60 ]; then color='\033[38;5;70m'
  elif [ "$pct" -lt 85 ]; then color='\033[38;5;178m'
  else                         color='\033[38;5;167m'
  fi

  filled=$(( (pct * CELLS + 99) / 100 ))
  [ "$filled" -gt "$CELLS" ] && filled=$CELLS
  [ "$filled" -lt 1 ] && [ "$pct" -gt 0 ] && filled=1

  bar=$(build_bar "$(printf '█')" "$(printf '░')" "$filled")
  # A non-UTF-8 locale silently mangles the block glyphs — detect and use ASCII.
  [ "${#bar}" -ne "$CELLS" ] && bar=$(build_bar '#' '-' "$filled")

  printf "%b[%s] %d%% %s%b" "$color" "$bar" "$pct" "$(human "$ctx")" '\033[0m'
  [ -n "$total" ] && [ "$total" -gt 0 ] 2>/dev/null &&
    printf "%b · ↻ %s%b" '\033[38;5;244m' "$(human "$total")" '\033[0m'
}

# json_escape <string> — escape for embedding in a JSON string value. ANSI
# colours are rendered as-is by Claude Code, but a raw ESC byte is an illegal
# control character inside JSON, so it has to go out as .
json_escape() {
  printf '%s' "$1" | awk -v esc="$(printf '\033')" '
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      gsub(esc, "\\u001b")
      printf "%s", $0
    }
  '
}

# ----------------------------------------------------------------- transcript
# Fallback for Claude Code versions that do not report `context_window` on the
# statusline stdin. Emits "<context_tokens> <total_billable_tokens>".
#
# Context is the last assistant turn's input + cache_read + cache_creation —
# that is what actually occupies the window. Totals sum every assistant turn,
# deduplicated by requestId: one API response is written as several lines (one
# per content block) and each line repeats the same usage. Only the top-level
# "usage" object of a line is read; the nested per-iteration copies would
# double-count too.
scan_transcript() {
  awk '
    index($0, "\"type\":\"assistant\"") == 0 { next }
    {
      i = index($0, "\"usage\":{")
      if (i == 0) next
      s = substr($0, i)
      ctx = num(s, "\"input_tokens\":") + num(s, "\"cache_creation_input_tokens\":") \
          + num(s, "\"cache_read_input_tokens\":")

      req = str($0, "\"requestId\":\"")
      if (req != "" && seen[req]++) next
      total += ctx + num(s, "\"output_tokens\":")
    }
    END { printf "%d %d\n", ctx, total }

    function num(line, key,   p) {
      p = index(line, key)
      return p == 0 ? 0 : substr(line, p + length(key)) + 0
    }

    function str(line, key,   p, rest, q) {
      p = index(line, key)
      if (p == 0) return ""
      rest = substr(line, p + length(key))
      q = index(rest, "\"")
      return q == 0 ? "" : substr(rest, 1, q - 1)
    }
  ' "$1" 2>/dev/null
}
