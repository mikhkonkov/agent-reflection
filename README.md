<div align="center">

# Agent Reflection

**Local-first session auditing and agent-workflow recommendations for [Claude Code](https://claude.com/claude-code).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org)
[![Offline](https://img.shields.io/badge/network-zero%20requests-blue.svg)](#privacy-guarantees)

**English** · [Русский](README.ru.md) · [Español](README.es.md)

</div>

Agent Reflection observes your coding-agent sessions through Claude Code hooks,
stores **privacy-safe local telemetry**, detects inefficient agent workflows,
and produces evidence-based recommendations after each session.

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

---

## Contents

- [Why](#why)
- [What it is — and what it is not](#what-it-is--and-what-it-is-not)
- [Installation](#installation)
- [CLI usage](#cli-usage)
- [How reports work](#how-reports-work)
- [Bundled agents](#bundled-agents)
- [Reading the report from inside Claude Code](#reading-the-report-from-inside-claude-code)
- [Statusline context meter](#statusline-context-meter)
- [Privacy guarantees](#privacy-guarantees)
- [Deleting all local data](#deleting-all-local-data)
- [Limitations](#limitations)

## Why

A session ends, the context has grown to 80%, and you have no idea what ate it.
The twenty file reads before the first edit? The test that failed six times in a
row? The compaction halfway through?

And the bill is not linear: every request re-sends the whole conversation, so a
junk file dump early on keeps being paid for in every turn after it. Cost grows
with the *square* of session length — noise cleared early is worth far more than
noise cleared late.

Agent Reflection is a **feedback loop for the developer, not for the model**: a
short, evidence-based post-mortem of your own session — where the tokens went,
which parts were expensive, which of them a cheap read-only subagent could have
absorbed — written locally, with no prompts or code leaving the machine.

## What it is — and what it is not

Agent Reflection helps you reduce the **total cost of successful work**, not merely
token count. It encourages a simple workflow:

1. Use a cheap model for bounded read-only exploration.
2. Use a standard model for well-scoped implementation.
3. Escalate to a stronger reasoning model only when the evidence justifies it.
4. Keep noisy operations out of the main context window.

> [!IMPORTANT]
> **This is not a guaranteed model optimizer.** Agent Reflection never claims to
> know the universally optimal model, and it never claims a different model
> *would* have produced a cheaper or better result. It only surfaces
> **observable signals** — read-only exploration in the main context, repeated
> failure loops, context pressure, and bounded exploration segments — and frames
> every recommendation as a candidate for you to judge.

Everything runs **entirely offline** after installation. Agent Reflection makes no
network requests and sends no code, prompts, tool output, telemetry, or
repository metadata anywhere.

## Installation

**Requirements:** Node.js 22+, pnpm, Claude Code.

The repository doubles as a Claude Code marketplace
(`.claude-plugin/marketplace.json`), so it installs straight from GitHub — no
registry involved. `dist/` is committed, so there is nothing to build.

### Quick install

Paste this into a Claude Code session — any repository, any `CLAUDE_CONFIG_DIR`
— and let the agent run the install for you:

````text
Install the "agent-reflection" Claude Code plugin
(https://github.com/mikhkonkov/agent-reflection) for me:

1. Determine my Claude config directory: use $CLAUDE_CONFIG_DIR if that env
   var is set, otherwise default to ~/.claude. Use this directory for every
   path below.

2. Run:
   claude plugin marketplace add mikhkonkov/agent-reflection
   claude plugin install agent-reflection@agent-reflection --scope user

3. Hooks run from the version-scoped plugin cache, which ships without
   node_modules. Find the newest directory under
   <config-dir>/plugins/cache/agent-reflection/agent-reflection/ and run:
   pnpm install --prod --dir <that-directory>

4. The CLI lives in a separate copy, the marketplace clone at
   <config-dir>/plugins/marketplaces/agent-reflection, which needs its own
   dependencies:
   pnpm install --prod --dir <config-dir>/plugins/marketplaces/agent-reflection

5. Optionally symlink the CLI onto my PATH (ask which directory, default
   ~/.local/bin):
   ln -sf <config-dir>/plugins/marketplaces/agent-reflection/dist/cli/index.js \
     <path-on-PATH>/agent-reflection

6. Verify with `claude plugin list` that agent-reflection loaded.

7. `agent-reflection init` prompts interactively (storage setup, optional
   statusline), so it needs a real TTY. Don't run it yourself — tell me to run
   it in my own terminal, in each repository I want observed.

8. Tell me to restart Claude Code so the hooks take effect.

If any step fails or an expected path doesn't exist, stop and show me the
error instead of guessing.
````

### Manual installation

```bash
claude plugin marketplace add mikhkonkov/agent-reflection
claude plugin install agent-reflection@agent-reflection --scope user

# runtime dependencies for the installed copy (better-sqlite3 is native).
# Hooks run from the version-scoped plugin cache, not from the marketplace clone:
pnpm install --prod --dir \
  "$(ls -d ~/.claude/plugins/cache/agent-reflection/agent-reflection/*/ | tail -1)"
```

Without that step the hooks find no `better-sqlite3`, record nothing, and exit
`0` silently — so re-run it after every plugin update, which installs into a new
version directory.

Restart Claude Code afterwards so the hooks load.

To get the `agent-reflection` CLI on your `PATH`, link it out of the marketplace
clone. That clone is a **second copy**, separate from the plugin cache above, so
it needs its own dependencies:

```bash
pnpm install --prod --dir ~/.claude/plugins/marketplaces/agent-reflection

ln -sf ~/.claude/plugins/marketplaces/agent-reflection/dist/cli/index.js \
  ~/.local/bin/agent-reflection
```

Skip the `pnpm install` and the CLI dies on `Cannot find package 'commander'`
while the hooks keep working fine — the two copies fail independently.

Any directory on your `PATH` works; `~/.local/bin` is only a common default.

Then, in each repository you want observed:

```bash
agent-reflection init
```

This is optional — storage is created automatically on the first session in a
repository. `init` only writes the config file up front and offers to install
the statusline (`--statusline` / `--skip-statusline` to answer non-interactively).

Verify with `claude plugin list`.

<details>
<summary>If you run Claude Code with a custom <code>CLAUDE_CONFIG_DIR</code></summary>

Plugins are installed per config directory. A separate profile — say a shell
alias that sets `CLAUDE_CONFIG_DIR=~/.claude-work` — has its own plugin list, and
an install into `~/.claude` is invisible to it: the skill and hooks never show up.

Export the same variable, then run the install with the paths adjusted:

```bash
export CLAUDE_CONFIG_DIR=~/.claude-work

claude plugin marketplace add mikhkonkov/agent-reflection
claude plugin install agent-reflection@agent-reflection --scope user
pnpm install --prod --dir \
  "$(ls -d "$CLAUDE_CONFIG_DIR"/plugins/cache/agent-reflection/agent-reflection/*/ | tail -1)"
```

The `PATH` symlink follows the same rule — the marketplace clone lives under that
config directory too:

```bash
pnpm install --prod --dir "$CLAUDE_CONFIG_DIR"/plugins/marketplaces/agent-reflection

ln -sf "$CLAUDE_CONFIG_DIR"/plugins/marketplaces/agent-reflection/dist/cli/index.js \
  ~/.local/bin/agent-reflection
```

One symlink is enough no matter how many config directories you have; any clone
serves the same CLI, as long as that clone has its dependencies installed.

Repeat for every config directory you use. If `claude plugin list` reports
`✘ failed to load … not found in marketplace`, that config directory holds a
stale entry: remove the plugin and its marketplace, then install again.

</details>

> [!NOTE]
> `claude plugin marketplace update agent-reflection` pulls a new version;
> always re-run the `pnpm install --prod` line afterwards — the update lands in a
> fresh, empty version directory under the plugin cache.

> [!NOTE]
> `better-sqlite3` is a native module. If your Node version has no prebuilt
> binary, pnpm compiles it from source (build scripts are allow-listed in
> `package.json`). On a "Could not locate the bindings file" error, run
> `pnpm rebuild better-sqlite3`.

### Uninstall

```bash
claude plugin uninstall agent-reflection@agent-reflection --scope user --yes
claude plugin marketplace remove agent-reflection
```

Uninstalling the plugin stops all collection.

### Hooks

Hooks register against `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `SubagentStop`, `PreCompact` and `SessionEnd`. Each event runs
`hooks/hook-router.mjs`, which reads the hook JSON on stdin, normalizes it into a
privacy-safe event, and persists it locally. The router **always exits `0`**, so
a telemetry problem can never block Claude Code or a tool call.

## CLI usage

```bash
agent-reflection init                              # create local storage + config
agent-reflection report latest                     # print the most recent session report
agent-reflection report current                    # the session in progress right now
agent-reflection report previous                   # the last session that finished
agent-reflection report <session-id>               # print a specific report
agent-reflection sessions                          # list recent sessions
agent-reflection sessions --repo .                 # scope to the current repository
agent-reflection stats --days 30                   # aggregate stats (no cost estimates)
agent-reflection config show
agent-reflection config set privacy.storeRawPayloads false
```

## How reports work

At `SessionEnd`, Agent Reflection:

1. Loads all events for the session.
2. Builds deterministic aggregate metrics.
3. Runs five local, rule-based checks.
4. Saves recommendations and writes a Markdown report to
   `.agent-reflection/reports/<YYYY-MM-DD>-<session-id>.md`.
5. Optionally prints a one-line summary.

| Rule | Signal |
|---|---|
| `excessive-main-context-exploration` | Lots of read-only discovery in the main context |
| `repeated-execution-failure` | An edit → execution failure loop |
| `model-escalation-candidate` | An unproductive loop that may warrant independent diagnosis |
| `context-pressure` | Compaction and/or large observed output |
| `cheap-subagent-candidate` | A bounded read-only exploration segment |

Reports are **deterministic**: identical input events produce a byte-identical
report body.

## Bundled agents

Three subagents encode the routing this tool encourages:

| Agent | Model | Purpose |
|---|---|---|
| `explore-cheap` | Haiku, read-only | Locating files, tracing code paths, summarizing modules, collecting evidence. No edits, no Bash. |
| `implement-standard` | Sonnet | Well-scoped implementation with narrow validation and minimal changes. |
| `architect-escalation` | Opus, read-only | Independent diagnosis of repeated failures, ambiguous architecture, migrations, concurrency, or hard debugging *before* further edits. |

Agent Reflection never launches a subagent or changes configuration on its own;
the skills always ask first.

## Reading the report from inside Claude Code

No need to leave the session to see the result. Run the bundled skill at the end
of one:

```text
/agent-reflection:agent-reflection-report
```

It loads the latest report and walks through the top recommendations with their
evidence — same content as `agent-reflection report latest`, but in context,
where you can ask follow-up questions about a finding.

## Statusline context meter

The report tells you where the tokens went *after* the session; the statusline
tells you **while it is still happening**. Context growth is otherwise invisible
— nothing warns you until Claude Code compacts, drops the earlier half of the
conversation, and the agent re-reads files it already knew:

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

Fill bar, share of the context window in use, tokens currently in it, and `↻` the
session total including everything already compacted away.

Green below 60%, yellow to 85%, red above — the band where compaction becomes
likely. Yellow is the cue to act while you still have room: finish the current
thread, hand the next exploration to a cheap read-only subagent, or start a fresh
session instead of letting a compaction decide what gets forgotten.

While subagents are running, each row in the agent panel gets its own meter,
scoped to that agent's context rather than the main one:

```text
explore-cheap        [██░░░░░░░░] 18% 36K · locate auth middleware
architect-escalation [█████████░] 85% 170K · diagnose repeated failure
```

The **subagent rows install themselves** with the plugin (`settings.json` →
`subagentStatusLine`). The **main statusline cannot be registered by a plugin** in
Claude Code — it lives in your own settings file — so the plugin mentions it
**once**, on the first session in a repository, and only sets it up if you say
yes:

```bash
agent-reflection init                    # asks before touching your settings
agent-reflection init --statusline       # install it, no prompt (scripts, CI)
agent-reflection init --skip-statusline  # leave the statusline alone

agent-reflection config set statusline.promptOnSessionStart false   # never ask
```

An existing `statusLine` is not clobbered: it is moved into
`AGENT_REFLECTION_STATUSLINE_CHAIN`, rendered as a prefix, and restored on uninstall.
The scripts are copied into `~/.claude/agent-reflection/statusline/` and `statusLine`
points at that copy, so moving or deleting the checkout does not break the meter.

They are pure bash + awk (`statusline/`), because a statusline re-renders
constantly and a node start-up is visible latency. Readings come from the
`context_window` fields Claude Code passes on stdin — the same numbers as
`/context` — falling back to parsing the transcript on older versions.

## Privacy guarantees

By default, Agent Reflection **never persists**: full prompt text, full tool input,
full tool output, source code, terminal/test output, environment values, secrets,
API keys, full absolute paths, or external URLs.

It stores only aggregate, non-sensitive telemetry: session id, a hashed repository
identifier, repository basename, branch name, event name, timestamps, tool name
and classification, success flags, input/output **character lengths**, durations,
relative paths (only when safely derivable from `cwd`), path counts, normalized
error categories, subagent lifecycle, compaction triggers, and a SHA-256 **hash**
of each prompt (never its text).

Raw-payload storage exists only as an explicitly disabled-by-default option
(`privacy.storeRawPayloads`, `privacy.storePromptText`, `privacy.storeToolOutput`
— all `false`). Even when enabled, likely secrets (API keys, bearer tokens,
private keys, passwords, `KEY=value` env assignments) are redacted before anything
is written.

### Storage layout

Repository-local when writable:

```text
<repository-root>/.agent-reflection/
├── agent-reflection.db        # SQLite database
├── config.json
├── events/<session-id>.jsonl
└── reports/<YYYY-MM-DD>-<session-id>.md
```

Otherwise a per-repository fallback keyed by a stable SHA-256 of the absolute
repository path (the path itself is never stored in the directory name):

```text
~/.agent-reflection/projects/<repository-hash>/
```

## Deleting all local data

All data is local. To remove it:

```bash
rm -rf .agent-reflection                        # repository-local storage
rm -rf ~/.agent-reflection/projects/<hash>      # fallback storage for a repo
rm -rf ~/.agent-reflection                      # every project's fallback storage
```

## Limitations

- **Recommendations are heuristics, not verdicts.** They flag observable
  patterns; they do not prove a different model or route would have been better.
- **Token-to-dollar accounting is intentionally omitted.** Sizes are measured in
  characters/bytes of observed input/output, not billed tokens.
- **Hook mapping.** Real Claude Code does not expose `PostToolUseFailure` or a
  subagent-start hook. Agent Reflection derives tool *failure* from `PostToolUse`
  payloads and treats a `PreToolUse` `Task` invocation as a subagent-start
  signal. These are derived signals and may differ across Claude Code releases.
- Estimated "turns" is a documented heuristic (`prompts + main-agent tool calls`),
  not an exact conversation-turn count.
- **No outcome feedback loop.** Every rule is a heuristic scored from session
  shape alone; nothing records whether the work actually succeeded, so a noisy
  but successful session looks the same as a stuck one. Manual outcome labels
  (`accepted` / `rework` / `failed`) shipped and were removed — nobody performs a
  per-session labelling chore, so the data was never there when the rules needed
  it. Revisit as **inferred** outcome instead: a commit after the session, the
  next session reopening the same files, failures clustered at the end. The
  unused `sessions.user_outcome` column is retained for that.
- Only Claude Code is supported — not Cursor, Codex, Windsurf, or other CLIs.
- No cloud, no dashboard, no auth, no automatic model switching, and no automatic
  code changes or subagent execution.

## Contributing

Development setup, the `Makefile` plugin lifecycle, and the statusline installer
flags live in [CLAUDE.md](./CLAUDE.md).

## License

MIT — see [LICENSE](./LICENSE).
