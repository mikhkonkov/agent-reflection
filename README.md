<div align="center">

# Agent Reflection

**Local-first session auditing and agent-workflow recommendations for [Claude Code](https://claude.com/claude-code).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org)
[![Offline](https://img.shields.io/badge/network-zero%20requests-blue.svg)](#privacy-guarantees)

</div>

Agent Reflection observes your coding-agent sessions through Claude Code hooks,
stores **privacy-safe local telemetry**, detects inefficient agent workflows,
and produces evidence-based recommendations after each session.

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

---

## Contents

- [What it is — and what it is not](#what-it-is--and-what-it-is-not)
- [Installation](#installation)
- [CLI usage](#cli-usage)
- [How reports work](#how-reports-work)
- [Bundled agents](#bundled-agents)
- [Statusline context meter](#statusline-context-meter)
- [Privacy guarantees](#privacy-guarantees)
- [Deleting all local data](#deleting-all-local-data)
- [Limitations of the MVP](#limitations-of-the-mvp)

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

The repository doubles as a local Claude Code marketplace
(`.claude-plugin/marketplace.json`) — no registry, no network.

```bash
git clone <repository-url> agent-reflection
cd agent-reflection

pnpm install && pnpm build

claude plugin marketplace add .
claude plugin install agent-reflection@agent-reflection-local --scope user
```

Restart Claude Code afterwards so the hooks load, then initialize storage in the
repository you want to audit:

```bash
agent-reflection init
```

Verify with `claude plugin list`.

> [!NOTE]
> `better-sqlite3` is a native module. If your Node version has no prebuilt
> binary, pnpm compiles it from source (build scripts are allow-listed in
> `package.json`). On a "Could not locate the bindings file" error, run
> `pnpm rebuild better-sqlite3`.

### Uninstall

```bash
claude plugin uninstall agent-reflection@agent-reflection-local --scope user --yes
claude plugin marketplace remove agent-reflection-local
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

A bundled skill — `agent-reflection-report` — helps you view reports from inside
Claude Code. Agent Reflection never launches a subagent or changes configuration on
its own; the skills always ask first.

## Statusline context meter

A traffic-light meter for how full the context window is, and how many tokens the
session has spent:

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

Green below 60% of the window, amber to 85%, red above — the band where
compaction becomes likely and work is better handed to a subagent.

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

## Limitations of the MVP

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
  (`accepted` / `rework` / `failed`) shipped and were removed — the labelling
  step is a per-session chore nobody performs, so the data was never there when
  the rules needed it. Revisit as **inferred** outcome: derive the signal from
  what already gets recorded (a commit after the session, the next session
  reopening the same files, failures clustered at the end) instead of asking.
  The `sessions.user_outcome` column is retained, unused, for that.
- Only Claude Code is supported — not Cursor, Codex, Windsurf, or other CLIs.
- No cloud, no dashboard, no auth, no automatic model switching, and no automatic
  code changes or subagent execution.

## Contributing

Development setup, the `Makefile` plugin lifecycle, and the statusline installer
flags live in [CLAUDE.md](./CLAUDE.md).

## License

MIT — see [LICENSE](./LICENSE).
