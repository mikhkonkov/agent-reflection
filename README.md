# Agent Auditor

Local-first session auditing and agent-workflow recommendations for
[Claude Code](https://claude.com/claude-code).

Agent Auditor observes your coding-agent sessions through Claude Code hooks,
stores **privacy-safe local telemetry**, detects inefficient agent workflows,
and produces evidence-based recommendations after each session.

## What it is — and what it is not

Agent Auditor helps you reduce the **total cost of successful work**, not merely
token count. It encourages a simple workflow:

1. Use a cheap model for bounded read-only exploration.
2. Use a standard model for well-scoped implementation.
3. Escalate to a stronger reasoning model only when the evidence justifies it.
4. Keep noisy operations out of the main context window.

> **This is not a guaranteed model optimizer.** Agent Auditor never claims to
> know the universally optimal model, and it never claims a different model
> *would* have produced a cheaper or better result. It only surfaces
> **observable signals** — read-only exploration in the main context, repeated
> failure loops, context pressure, and bounded exploration segments — and frames
> every recommendation as a candidate for you to judge.

Everything runs **entirely offline** after installation. Agent Auditor makes no
network requests and sends no code, prompts, tool output, telemetry, or
repository metadata anywhere.

## Requirements

- Node.js 22 or newer
- pnpm
- Claude Code

## Installation

```bash
pnpm install
pnpm build
```

`better-sqlite3` is a native module. If your Node version has no prebuilt binary,
pnpm compiles it from source on install (build scripts for `better-sqlite3` are
allow-listed in `package.json`). If you ever see a "Could not locate the bindings
file" error, run `pnpm rebuild better-sqlite3`.

Then initialize storage in the repository you want to audit:

```bash
node dist/cli/index.js init
# or, once linked on your PATH:
agent-auditor init
```

## Plugin installation

Agent Auditor ships as a Claude Code plugin. This directory is also a local
marketplace (`.claude-plugin/marketplace.json`), so it can be installed straight
from disk — no registry, no network.

Build first (`pnpm install && pnpm build`) — the hooks import from `dist/`, and
installation copies a snapshot of the directory as it is on disk.

```bash
# from the repository root
claude plugin marketplace add .
claude plugin install agent-auditor@agent-auditor-local --scope user
```

Restart Claude Code afterwards so the hooks load.

To remove it:

```bash
claude plugin uninstall agent-auditor@agent-auditor-local --scope user --yes
claude plugin marketplace remove agent-auditor-local
```

The same flows are wrapped in the `Makefile`, always scoped to the current
directory:

```bash
make install      # add this directory as a marketplace, install the plugin
make uninstall    # uninstall the plugin, remove the marketplace
make reinstall    # uninstall, then install again — use after editing hooks/agents/skills
make status       # list installed plugins and configured marketplaces
make build        # pnpm install + pnpm build
```

Use `make reinstall` whenever you change `.claude-plugin/`, `hooks/`, `agents/`,
or `skills/` — Claude Code copies the plugin at install time, so edits are not
picked up until it is installed again.

Verify the install with:

```bash
claude plugin list
```

The hooks register against these Claude Code lifecycle events:

`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStop`,
`PreCompact`, `SessionEnd`.

Each event runs `hooks/hook-router.mjs`, which reads the hook JSON on stdin,
normalizes it into a privacy-safe event, and persists it locally. The router
**always exits `0`** so a telemetry problem can never block Claude Code or a tool
call.

## How reports work

At `SessionEnd`, Agent Auditor:

1. Loads all events for the session.
2. Builds deterministic aggregate metrics.
3. Runs five local, rule-based checks.
4. Saves recommendations and writes a Markdown report to
   `.agent-auditor/reports/<YYYY-MM-DD>-<session-id>.md`.
5. Optionally prints a one-line summary.

The rules:

| Rule | Signal |
|---|---|
| `excessive-main-context-exploration` | Lots of read-only discovery in the main context |
| `repeated-execution-failure` | An edit → execution failure loop |
| `model-escalation-candidate` | An unproductive loop that may warrant independent diagnosis |
| `context-pressure` | Compaction and/or large observed output |
| `cheap-subagent-candidate` | A bounded read-only exploration segment |

Reports are **deterministic**: identical input events produce a byte-identical
report body.

## CLI usage

```bash
agent-auditor init                              # create local storage + config
agent-auditor report latest                     # print the most recent session report
agent-auditor report current                    # the session in progress right now
agent-auditor report previous                   # the last session that finished
agent-auditor report <session-id>               # print a specific report
agent-auditor sessions                          # list recent sessions
agent-auditor sessions --repo .                 # scope to the current repository
agent-auditor stats --days 30                   # aggregate stats (no cost estimates)
agent-auditor config show
agent-auditor config set privacy.storeRawPayloads false
```

## Bundled agents

Three subagents encode the routing this tool encourages:

- **`explore-cheap`** (Haiku, read-only) — locating files, tracing code paths,
  summarizing modules, collecting evidence. No edits, no Bash.
- **`implement-standard`** (Sonnet) — well-scoped implementation with narrow
  validation and minimal changes.
- **`architect-escalation`** (Opus, read-only) — independent diagnosis of
  repeated failures, ambiguous architecture, migrations, concurrency, or hard
  debugging *before* further edits.

A bundled skill — `agent-auditor-report` — helps you view reports from inside
Claude Code. Agent Auditor never
launches a subagent or changes configuration on its own; the skills always ask
first.

## Statusline context meter

A traffic-light meter for how full the context window is, and how many tokens
the session has spent:

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
`subagentStatusLine`). The **main statusline cannot be registered by a plugin**
in Claude Code — it lives in your own settings file — so the plugin mentions it
**once**, on the first session in a repository, and only sets it up if you say
yes. To never be asked:

```bash
agent-auditor config set statusline.promptOnSessionStart false
```

The usual path is `agent-auditor init`, which offers the meter as part of setup:

```bash
agent-auditor init                    # asks before touching your settings
agent-auditor init --statusline       # install it, no prompt (scripts, CI)
agent-auditor init --skip-statusline  # leave the statusline alone
```

Setting it up separately, whether from that offer or by hand:

```bash
make install-statusline      # patch ~/.claude/settings.json (backup written)
make uninstall-statusline    # restore the previous statusline
bash statusline/install.sh --project    # patch ./.claude/settings.json instead
bash statusline/install.sh --in-place   # point at this checkout, not a copy
bash statusline/install.sh --print      # just show the JSON snippet
```

The scripts are copied into `~/.claude/agent-auditor/statusline/` and
`statusLine` points at that copy, so moving or deleting this checkout does not
break the meter. Re-run the installer after editing the scripts, or install
`--in-place` while working on them.

An existing `statusLine` is not clobbered: it is moved into
`AGENT_AUDITOR_STATUSLINE_CHAIN`, rendered as a prefix, and restored on
uninstall.

The scripts are pure bash + awk (`statusline/`), because a statusline re-renders
constantly and a node start-up is visible latency. Readings come from the
`context_window` fields Claude Code passes on stdin — the same numbers as
`/context` — falling back to parsing the transcript on older versions.

## Privacy guarantees

By default, Agent Auditor **never persists**: full prompt text, full tool input,
full tool output, source code, terminal/test output, environment values,
secrets, API keys, full absolute paths, or external URLs.

It stores only aggregate, non-sensitive telemetry: session id, a hashed
repository identifier, repository basename, branch name, event name, timestamps,
tool name and classification, success flags, input/output **character lengths**,
durations, relative paths (only when safely derivable from `cwd`), path counts,
normalized error categories, subagent lifecycle, compaction triggers, and a
SHA-256 **hash** of each prompt (never its text).

Raw-payload storage exists only as an explicitly disabled-by-default option
(`privacy.storeRawPayloads`, `privacy.storePromptText`, `privacy.storeToolOutput`
— all `false`). Even when enabled, likely secrets (API keys, bearer tokens,
private keys, passwords, `KEY=value` env assignments) are redacted before
anything is written.

### Storage layout

Repository-local when writable:

```text
<repository-root>/.agent-auditor/
├── agent-auditor.db        # SQLite database
├── config.json
├── events/<session-id>.jsonl
└── reports/<YYYY-MM-DD>-<session-id>.md
```

Otherwise a per-repository fallback keyed by a stable SHA-256 of the absolute
repository path (the path itself is never stored in the directory name):

```text
~/.agent-auditor/projects/<repository-hash>/
```

## Deleting all local data

All data is local. To remove it:

```bash
rm -rf .agent-auditor                        # repository-local storage
rm -rf ~/.agent-auditor/projects/<hash>      # fallback storage for a repo
rm -rf ~/.agent-auditor                      # every project's fallback storage
```

Uninstalling the plugin stops all collection.

## Limitations of the MVP

- **Recommendations are heuristics, not verdicts.** They flag observable
  patterns; they do not prove a different model or route would have been better.
- **Token-to-dollar accounting is intentionally omitted.** Sizes are measured in
  characters/bytes of observed input/output, not billed tokens.
- **Hook mapping.** Real Claude Code does not expose `PostToolUseFailure` or a
  subagent-start hook. Agent Auditor derives tool *failure* from `PostToolUse`
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

## Development

```bash
pnpm install          # install dependencies
pnpm build            # compile TypeScript to dist/
pnpm typecheck        # type-check without emitting
pnpm lint             # ESLint
pnpm test             # run unit + integration tests
pnpm test:coverage    # run tests with coverage (analysis ≥ 80%)
```

## License

MIT — see [LICENSE](./LICENSE).
