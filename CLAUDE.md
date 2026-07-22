# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

Agent Reflection is a **local-first Claude Code plugin** (TypeScript, ESM, Node >= 22).
It observes coding-agent sessions through Claude Code hooks, stores privacy-safe
telemetry in a repo-local SQLite database, runs deterministic rules over the
session, and writes a Markdown report with agent-workflow recommendations.

Two hard product constraints drive most design decisions:

1. **Offline / no network.** Nothing in `src/` or `hooks/` may make a network
   request. No telemetry, no registry, no fetch.
2. **Privacy by default.** Prompt text, tool input/output, source code and
   absolute paths are never persisted unless explicitly opted in via
   `privacy.*` config (all `false` by default), and even then secrets are
   redacted first. See `src/collector/redactor.ts` and
   `src/collector/path-sanitizer.ts`.

## Commands

```bash
pnpm install          # deps (better-sqlite3 is a native module, allow-listed in package.json)
pnpm build            # tsc -> dist/
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm format           # prettier --write .
pnpm test             # vitest run
pnpm test:coverage    # vitest + v8 coverage; 80% threshold enforced on src/analysis/**
```

Plugin lifecycle — the repo root doubles as a local marketplace
(`.claude-plugin/marketplace.json`), installed as
`agent-reflection@agent-reflection-local`. Everything is scoped to the current
directory:

```bash
make build        # pnpm install + pnpm build
make install      # add this directory as a marketplace, install the plugin
make uninstall    # uninstall the plugin, remove the marketplace
make reinstall    # uninstall, then install again
make status       # list installed plugins and configured marketplaces
```

Underneath, `make install` is:

```bash
claude plugin marketplace add .
claude plugin install agent-reflection@agent-reflection-local --scope user
```

Claude Code copies the plugin at install time, so use `make reinstall` after
editing `.claude-plugin/`, `hooks/`, `agents/` or `skills/` — otherwise the
edits are not picked up. Restart Claude Code afterwards so the hooks reload.

The copy that actually runs lives in the **version-scoped plugin cache**
(`~/.claude/plugins/cache/agent-reflection-local/agent-reflection/<version>/`),
not in the marketplace clone, and it ships **without `node_modules`**. Every
install or update therefore needs runtime deps installed into that new
directory, or the hooks import-fail on `better-sqlite3` and record nothing:

```bash
pnpm install --prod --dir \
  "$(ls -d ~/.claude/plugins/cache/agent-reflection-local/agent-reflection/*/ | tail -1)"
```

The failure is silent by design (`hooks/hook-router.mjs` guards the dynamic
import), so an empty `sessions` table is the symptom to look for.

Statusline installer (patches settings files, writes a backup):

```bash
make install-statusline                 # patch ~/.claude/settings.json
make uninstall-statusline               # restore the previous statusline
bash statusline/install.sh --project    # patch ./.claude/settings.json instead
bash statusline/install.sh --in-place   # point at this checkout, not a copy
bash statusline/install.sh --print      # just show the JSON snippet
```

Use `--in-place` while working on the scripts; otherwise re-run the installer
after each edit, since it installs a copy under
`~/.claude/agent-reflection/statusline/`.

If `better-sqlite3` fails with "Could not locate the bindings file", run
`pnpm rebuild better-sqlite3`.

`hooks/hook-router.mjs` imports from `dist/`, so **hooks run stale code until
`pnpm build` is re-run**. Always rebuild after touching `src/collector/`.

## Architecture

Data flows in one direction: hooks → events → aggregation → rules → report.

```
Claude Code hook (stdin JSON)
  └─ hooks/hook-router.mjs           thin .mjs shim, always exits 0
     └─ src/collector/               parse, validate, redact, persist
        hook-input-schema.ts         zod schema for raw hook payloads
        event-normalizer.ts          raw payload -> domain Event
        redactor.ts / path-sanitizer.ts
        jsonl-writer.ts              append-only .agent-reflection/events/*.jsonl
     └─ src/storage/                 better-sqlite3; migrations.ts owns schema
     └─ src/report/session-finalizer.ts   runs on SessionEnd
        └─ src/analysis/
           session-aggregator.ts     events -> metrics (RuleContext)
           rules/*.ts                five independent rules
           rule-engine.ts            runs + sorts all rules
           recommendation-factory.ts, phrasing.ts, report-renderer.ts
```

`src/domain/` holds pure types and classification logic (no I/O).
`src/shared/` holds cross-cutting utilities: `paths.ts` (storage resolution,
repo root discovery, repo-relative conversion), `result.ts`, `logger.ts`,
`clock.ts`, `ids.ts`.
`src/cli/` is a Commander app (`agent-reflection init | report | sessions | stats |
config`), entry `src/cli/index.ts`.

Manual outcome labels were removed (see README "Limitations of the MVP"). The
`sessions.user_outcome` column stays in migration 1 — never edit an existing
migration — but nothing reads or writes it. Any revival should infer the outcome
rather than ask the user for it.

Bundled agents live in `agents/` (`explore-cheap`, `implement-standard`,
`architect-escalation`); bundled skills in `skills/`.

`statusline/` is separate from all of the above: pure bash + awk, no TypeScript,
no database. `context-statusline.sh` is the main meter (opt-in, wired up by
`statusline/install.sh`), `subagent-statusline.sh` renders the agent-panel rows
and ships active via the plugin-root `settings.json` (`subagentStatusLine` — the
only statusline key a plugin may declare), and `meter.sh` holds the shared
rendering and JSON helpers. `subagentStatusLine` output is a contract: one JSON
line per row, `{"id":"<task id>","content":"<body>"}`, with the body JSON-escaped
(ESC as ``). Plain text on stdout is discarded and the row silently keeps
its default rendering. `install.sh` copies the main meter into
`~/.claude/agent-reflection/statusline/` and points `statusLine` at that copy, so
edits to the scripts need the installer re-run (or `--in-place`). Keep these interpreter-free: they re-render on every
tick, where a node start-up (~60ms) is visible latency.

Unlike `hooks/hooks.json`, Claude Code does **not** expand `${CLAUDE_PLUGIN_ROOT}`
for `subagentStatusLine.command` (confirmed empirically: it exits 127 every
time despite the identical variable working fine for hooks in the same
plugin). So the plugin-root `settings.json` points `subagentStatusLine` at a
bare literal path with no interpreter prefix, relying on the script's own
shebang — `~/.claude/agent-reflection/statusline/subagent-statusline.sh` — the
same pattern the upstream docs use. That fixed path is not populated by a
fresh plugin install (only `install.sh`'s opt-in flow touches it), so
`src/collector/subagent-statusline-sync.ts` copies `subagent-statusline.sh`
and `meter.sh` there on every `SessionStart` hook invocation, self-healing the
path without any manual step.

## Conventions

- **Hooks must never throw upward and must never block the user.** The collector
  path returns `Result<T, E>` (`src/shared/result.ts`) instead of throwing, and
  the `.mjs` shim swallows everything and exits 0. Preserve this when editing.
- **Reports are deterministic**: identical input events must produce a
  byte-identical report body. No timestamps-of-now, no map iteration order
  dependence, no randomness in `src/analysis/`. Rules are sorted by
  severity → confidence → ruleId in `rule-engine.ts`.
- **Recommendations are framed as candidates**, never as claims that another
  model would have been cheaper or better. Keep wording in `phrasing.ts`
  evidence-based and hedged. No cost estimates.
- Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
  NodeNext modules — **relative imports need the `.js` extension**.
- Diagnostics go to stderr via `logger` (`AGENT_REFLECTION_DEBUG=1` to enable
  debug). Hook stdout is a contract, not a log: the only writes are the
  SessionEnd summary line and the one-time SessionStart statusline offer
  (`src/collector/statusline-nudge.ts`), which Claude Code folds into context.
- Schema changes are additive migrations appended to the `MIGRATIONS` array in
  `src/storage/migrations.ts` (index + 1 = `PRAGMA user_version`). Never edit an
  existing migration.

## Testing

`tests/unit/` covers rules, aggregation, rendering, collector, config, paths.
`tests/integration/` covers the session lifecycle and privacy guarantees.
`tests/fixtures/*.jsonl` are recorded event streams — the preferred way to add a
rule case. Adding or changing a rule requires a fixture plus assertions in
`tests/unit/rules.test.ts`, and privacy-relevant changes require
`tests/integration/privacy.test.ts` to still pass.

## Storage layout

Repo-local when writable, otherwise `~/.agent-reflection/projects/<repo-hash>/`:

```text
.agent-reflection/
├── agent-reflection.db      # SQLite
├── config.json
├── events/               # append-only JSONL per session
└── reports/              # <YYYY-MM-DD>-<session-id>.md
```
