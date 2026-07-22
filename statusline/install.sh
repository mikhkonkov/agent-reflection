#!/bin/bash
# agent-reflection — wire the context meter into a Claude Code settings file.
#
# Claude Code plugins cannot register a statusLine, so installing the plugin is
# not enough: the user has to point `statusLine` at this script. That is what
# this does, explicitly and reversibly.
#
#   bash statusline/install.sh            # patch ~/.claude/settings.json
#   bash statusline/install.sh --project  # patch ./.claude/settings.json
#   bash statusline/install.sh --in-place # point at this checkout instead of a copy
#   bash statusline/install.sh --print    # print the JSON snippet, change nothing
#   bash statusline/install.sh --uninstall
#
# The scripts are copied into the Claude config dir and `statusLine` points at
# the copy, so the meter keeps working if this repository is moved or deleted.
# Re-run after editing the scripts to refresh that copy — or use --in-place to
# point straight at the checkout, which is what you want while developing them.
#
# An existing statusLine command is preserved: it is moved into
# AGENT_REFLECTION_STATUSLINE_CHAIN and rendered as a prefix, so an existing badge
# keeps working instead of being silently replaced.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_METER="$SCRIPT_DIR/context-statusline.sh"

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
INSTALL_DIR="$CONFIG_DIR/agent-reflection/statusline"
TARGET="$CONFIG_DIR/settings.json"
MODE="install"
IN_PLACE=0

for arg in "$@"; do
  case "$arg" in
    --project)   TARGET="$PWD/.claude/settings.json" ;;
    --in-place)  IN_PLACE=1 ;;
    --print)     MODE="print" ;;
    --uninstall) MODE="uninstall" ;;
    -h|--help)   sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$SOURCE_METER" ] || { echo "not found: $SOURCE_METER" >&2; exit 1; }

if [ "$IN_PLACE" = 1 ]; then
  METER="$SOURCE_METER"
else
  METER="$INSTALL_DIR/context-statusline.sh"
fi

if [ "$MODE" = "print" ]; then
  cat <<JSON
"statusLine": {
  "type": "command",
  "command": "bash \"$METER\""
}
JSON
  exit 0
fi

# Install the copy the settings file will point at. meter.sh comes along: the
# meter sources it as a sibling. Uninstall leaves the directory in place — it is
# inert, and removing it would break a second settings file still pointing here.
if [ "$MODE" = "install" ] && [ "$IN_PLACE" = 0 ]; then
  mkdir -p "$INSTALL_DIR"
  cp "$SCRIPT_DIR/context-statusline.sh" "$SCRIPT_DIR/meter.sh" "$INSTALL_DIR/"
  chmod +x "$INSTALL_DIR/context-statusline.sh"
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
    console.log("statusLine is not the agent-reflection meter — left untouched.");
    process.exit(0);
  }
  // Restore whatever we had wrapped, if anything.
  const chained = /AGENT_REFLECTION_STATUSLINE_CHAIN='([^']*)'/.exec(current)?.[1];
  if (chained) settings.statusLine = { type: "command", command: chained };
  else delete settings.statusLine;
  fs.writeFileSync(TARGET, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Removed the meter from ${TARGET} (backup: ${TARGET}.bak).`);
  process.exit(0);
}

// Whatever is currently rendered as a prefix. On a re-run the existing command
// is already ours, so the chain has to be read back out of it rather than
// wrapped again — otherwise re-running the installer would drop the user's
// original statusline instead of preserving it.
const chained = isOurs
  ? /AGENT_REFLECTION_STATUSLINE_CHAIN='([^']*)'/.exec(current)?.[1]
  : current;

let command = ours;
if (chained) {
  command = `AGENT_REFLECTION_STATUSLINE_CHAIN='${chained.replace(/'/g, "")}' ${ours}`;
  console.log(`Existing statusLine preserved as a prefix: ${chained}`);
}

settings.statusLine = { type: "command", command };
fs.writeFileSync(TARGET, JSON.stringify(settings, null, 2) + "\n");
console.log(`Wired the context meter into ${TARGET} (backup: ${TARGET}.bak).`);
console.log("Restart Claude Code to see it.");
NODE
