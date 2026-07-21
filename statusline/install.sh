#!/bin/bash
# agent-auditor — wire the context meter into a Claude Code settings file.
#
# Claude Code plugins cannot register a statusLine, so installing the plugin is
# not enough: the user has to point `statusLine` at this script. That is what
# this does, explicitly and reversibly.
#
#   bash statusline/install.sh            # patch ~/.claude/settings.json
#   bash statusline/install.sh --project  # patch ./.claude/settings.json
#   bash statusline/install.sh --print    # print the JSON snippet, change nothing
#   bash statusline/install.sh --uninstall
#
# An existing statusLine command is preserved: it is moved into
# AGENT_AUDITOR_STATUSLINE_CHAIN and rendered as a prefix, so an existing badge
# keeps working instead of being silently replaced.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METER="$SCRIPT_DIR/context-statusline.sh"

TARGET="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
MODE="install"

for arg in "$@"; do
  case "$arg" in
    --project)   TARGET="$PWD/.claude/settings.json" ;;
    --print)     MODE="print" ;;
    --uninstall) MODE="uninstall" ;;
    -h|--help)   sed -n '2,18p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$METER" ] || { echo "not found: $METER" >&2; exit 1; }

if [ "$MODE" = "print" ]; then
  cat <<JSON
"statusLine": {
  "type": "command",
  "command": "bash \"$METER\""
}
JSON
  exit 0
fi

mkdir -p "$(dirname "$TARGET")"
[ -f "$TARGET" ] || echo '{}' > "$TARGET"
cp "$TARGET" "$TARGET.bak"

MODE="$MODE" METER="$METER" TARGET="$TARGET" node <<'NODE'
const fs = require("node:fs");
const { MODE, METER, TARGET } = process.env;

const settings = JSON.parse(fs.readFileSync(TARGET, "utf8") || "{}");
const ours = `bash "${METER}"`;
const current = settings.statusLine?.command ?? "";
const isOurs = current.includes("context-statusline.sh");

if (MODE === "uninstall") {
  if (!isOurs) {
    console.log("statusLine is not the agent-auditor meter — left untouched.");
    process.exit(0);
  }
  // Restore whatever we had wrapped, if anything.
  const chained = /AGENT_AUDITOR_STATUSLINE_CHAIN='([^']*)'/.exec(current)?.[1];
  if (chained) settings.statusLine = { type: "command", command: chained };
  else delete settings.statusLine;
  fs.writeFileSync(TARGET, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Removed the meter from ${TARGET} (backup: ${TARGET}.bak).`);
  process.exit(0);
}

let command = ours;
if (current && !isOurs) {
  // Keep the existing statusline as a prefix rather than clobbering it.
  command = `AGENT_AUDITOR_STATUSLINE_CHAIN='${current.replace(/'/g, "")}' ${ours}`;
  console.log(`Existing statusLine preserved as a prefix: ${current}`);
}

settings.statusLine = { type: "command", command };
fs.writeFileSync(TARGET, JSON.stringify(settings, null, 2) + "\n");
console.log(`Wired the context meter into ${TARGET} (backup: ${TARGET}.bak).`);
console.log("Restart Claude Code to see it.");
NODE
