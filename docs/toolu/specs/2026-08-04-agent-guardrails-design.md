# agent-guardrails — Design

**Date:** 2026-08-04   **Status:** Approved   **Author:** falconiere   **Topic:** One shared, config-driven, self-tested guard-rail module replacing five per-stack `check-structure.sh` scripts, wired to fire at edit time via Claude Code hooks
**Decision record:** [`../decisions/2026-08-04-agent-guardrails.md`](../decisions/2026-08-04-agent-guardrails.md)

## Problem

The kit's structural checks live as five hand-written bash scripts
(`stacks/*/templates/scripts/check-structure.sh`, 45–80 lines each) with
overlapping logic, no shared configuration, and no tests. The `lefthook.yaml`
check is duplicated in all five; the banned-dependency loop in four. Expo's is
45 lines against marketing's 80 — they have already diverged, and every new rule
costs five edits. Meanwhile three rules the conventions state in prose have no
enforcer at all: function length, the shape *inside* a feature folder, and any
code pattern more contextual than a grep. And every check that does exist fires
at commit time at the earliest, so an agent writes a whole feature the wrong
shape before anything objects.

## Non-Goals

1. **Not a replacement for the existing gate layers.** Lefthook, `bun run check`,
   CI, and the AI review all remain mandatory. Hooks fire for Claude Code agents
   only — never for a human in an editor — so guardrails add a layer, they do not
   remove one.
2. **Not a linter.** Anything oxlint, oxfmt, clippy, or rustfmt already enforces
   stays with them. Guardrails own only what those tools structurally cannot see.
3. **No layer-dependency-direction rules in v1** (`api` must not import
   `features`, etc.). Partly covered by `no-restricted-imports` today; a
   follow-up once the module has a home.
4. **No declared domain registry in v1** — a `features/` child that isn't listed
   in config is not an error; only its internal shape is checked.
5. **No auto-fixing.** Guardrails report and exit nonzero. They never rewrite a
   file. An agent or a human does the fix.
6. ~~**No monorepo support** — single-repo projects, consistent with the kit.~~
   **Superseded 2026-08-06** by [`2026-08-06-database-ts-monorepo-design.md`](./2026-08-06-database-ts-monorepo-design.md):
   a root `guardrails.workspace.json` names the packages and `run.sh` re-execs
   itself once per package, so every check still runs in the single-root shape
   it was written for. The thirteen check ids are unchanged — workspace support
   is dispatch, not a new check.

## Architecture

`guardrails/` at the kit root is the single source of truth. Each generated
project receives a verbatim copy at `scripts/guardrails/` plus a
`guardrails.config.json` carrying that stack's data. **Stack differences become
data, not code** — that is the trade-off that drove the whole design: one
implementation with a config surface is harder to write than five bespoke
scripts, and it is the only version that stops the drift already visible in the
five files it replaces.

`validate-templates.sh` fails if any stack's copy differs from the kit source,
so the five copies cannot diverge again.

### One declaration, the best enforcer per language

The config **declares** the number; enforcement is **delegated** to whichever
tool sees that language best; the kit's own CI **proves** they agree. Without
that third step you get two ceilings that drift apart, which is the failure this
whole change exists to prevent.

| Rule | Declared in | Enforced (TS/TSX) | Enforced (Rust) | Enforced (Astro) |
| --- | --- | --- | --- | --- |
| File size | `fileSize.max` | oxlint `max-lines` | `checks/file-size.sh` | `checks/file-size.sh` |
| Function size | `functionSize.max` | oxlint `max-lines-per-function` | clippy `too_many_lines` | — (see Open Q1) |
| Folder shape | `src.*` | `checks/folder-tree.sh` | `checks/folder-tree.sh` | `checks/folder-tree.sh` |
| Banned deps | `bannedDeps` | oxlint `no-restricted-imports` + `checks/banned-deps.sh` | `checks/banned-deps.sh` | same as TS |
| Patterns | `patterns/*.yml` | ast-grep | ast-grep | — (unsupported language) |

`.astro` is why `checks/file-size.sh` must exist for TypeScript stacks too:
oxlint parses only an `.astro` file's frontmatter, so `max-lines` cannot see the
template body — the majority of the file.

### Every check is file-addressable

This falls out of the hook integration, not the gate: a `PostToolUse` hook fires
on every edit and cannot afford a whole-repo scan. Checks that are meaningfully
per-file accept `--file`; set-level checks run only in repo mode.

| Check | Repo mode | `--file` mode | Replaces |
| --- | --- | --- | --- |
| `folder-tree.sh` | full tree + README presence | placement of the one path | checks 1, 2 |
| `file-size.sh` | source files **not** owned by a linter (see below) | the one file | rust ceiling; `.astro` |
| `colocated-tests.sh` | centralized dirs + strays | is this path a stray test | checks 4, 5 |
| `no-barrels.sh` | all barrels | is this path a barrel | check 3 |
| `banned-deps.sh` | manifest scan | only when path is the manifest | check 8 |
| `shadow-configs.sh` | repo only | — | checks 6, 7 |
| `required-files.sh` | repo only | — | marketing 404, backend wrangler |
| `secrets.sh` | repo only | — | backend `.dev.vars` tracked |
| `patterns.sh` | `ast-grep scan` whole repo | `ast-grep scan <file>` | new |

Nine checks, not seven. `required-files.sh` and `secrets.sh` exist because the
five scripts being replaced already carry those rules and a migration that
dropped them would be a regression — marketing requires `src/pages/404.astro`
(without it, dead URLs return 200 with an empty body and get indexed) and
backend-ts requires `wrangler.jsonc` and fails if `.dev.vars` is tracked by git.

**`file-size.sh` must not double-enforce.** `fileSize.skipExtensions` lists the
extensions a linter already owns (`.ts`, `.tsx` — oxlint `max-lines`; `.rs` on
stacks where clippy covers it). Two enforcers of one ceiling is precisely the
drift this design exists to prevent, and a per-file `oxlint-disable` would
silence only one of them.

### Tested against real fixture trees

`guardrails/__tests__/fixtures/` holds a **clean** project tree and a
**violating** one. Every check must fire on the violating fixture and stay
silent on the clean one. These are real directory trees with real files — not
mocked filesystem calls — run by a real `run.sh` invocation. Risk 1 (a false
positive in a `Stop` hook costs up to 8 blocked turns) makes the silent-on-clean
half non-optional.

## Interfaces / Schema

### `guardrails/` layout

```
guardrails/
├── run.sh                    # entry point; sources config, dispatches checks, aggregates exits
├── lib/
│   ├── config.sh             # jq reads + required-key assertions
│   └── report.sh             # uniform violation formatting
├── checks/
│   ├── folder-tree.sh · file-size.sh · colocated-tests.sh
│   ├── no-barrels.sh · banned-deps.sh · shadow-configs.sh · patterns.sh
├── patterns/                 # ast-grep rule YAML, one file per rule
│   ├── ts/no-bare-fetch.yml · ts/no-hardcoded-hex.yml · ts/no-manual-orpc-key.yml
│   └── rust/no-direct-env-var.yml
├── schema.json               # JSON Schema for guardrails.config.json
└── __tests__/
    ├── run-fixtures.sh       # the test runner (kit CI calls this)
    └── fixtures/{clean,violating}/
```

Each `checks/*.sh` stays under the 300-line ceiling; `run.sh` is dispatch only.

**Copy manifest.** A generated project receives `run.sh`, `lib/`, `checks/`,
`patterns/` and `schema.json` — **not** `__tests__/`. The fixtures exist to prove
the kit's own checks work; shipping them into every project would put a
deliberately-violating source tree inside a repo whose gate forbids exactly
that. AC-12's byte-for-byte assertion is scoped to this manifest.

**The violating fixture ships as a plain directory tree, not a git repository.**
`secrets.sh` shells out to `git ls-files`, so its test needs a real repo — but
git cannot track a nested `.git` (it warns "adding embedded git repository" and
leaves the directory untracked, so the fixture would never survive a clone).
`run-fixtures.sh` therefore copies the fixture to a temp dir and runs `git init
&& git add` at test time. This is still real data — a real repository, really
constructed — not a mocked `git` call.

### `run.sh` contract

```bash
run.sh                     # repo mode  — every check, whole tree. The gate.
run.sh --file <path>       # scoped     — file-addressable checks for one path
run.sh --hook              # PostToolUse — reads hook JSON on stdin, extracts
                           #              .tool_input.file_path, then --file
run.sh --stop              # Stop hook  — repo mode behind two early-outs
run.sh --list              # prints each check id and its scope (for docs/debugging)
```

| Exit | Meaning | Used by |
| --- | --- | --- |
| `0` | clean | all modes |
| `1` | violations found | repo mode, `--file` |
| `2` | violations found | **`--hook` and `--stop`** |
| `3` | misconfigured — missing `jq`, missing/invalid config, unknown flag | all modes |

**Exit 2 is mandatory in both hook modes.** Claude Code ignores exit 1 from a
hook: only exit 2 shows stderr to the agent on `PostToolUse` and only exit 2
blocks on `Stop`. A `--stop` that exited 1 would make the entire Stop layer
silently inert while appearing to be wired up — the single most likely way to
ship this change broken.

`3` is distinct on purpose: a broken guardrail must never be mistakable for a
clean run.

Violation format, one per line on stderr:

```
guardrails[<check-id>] <path>: <what is wrong> — <what to do instead>
```

The second clause is mandatory. An agent that is told only what is wrong
retries blindly; Risk 1 is largely a message-quality problem.

### `guardrails.config.json`

```json
{
  "$schema": "./scripts/guardrails/schema.json",
  "version": 1,
  "srcRoot": "src",
  "src": {
    "topLevel": ["app","ui","features","api","utilities","providers","constants","types"],
    "nested": {
      "features/*": ["screens","components","hooks","api","__tests__"],
      "ui": ["theme","__tests__"],
      "api": ["clients","queries"]
    },
    "requireReadme": ["ui","features","api","utilities","providers"]
  },
  "fileSize":     { "max": 300, "overrides": { "src/ui/theme/*.ts": 500 },
                    "skipExtensions": [".ts",".tsx"] },
  "functionSize": { "max": 50,  "overrides": { "**/*.tsx": 80 } },
  "testDir": "__tests__",
  "testGlob": "*.test.ts *.test.tsx",
  "barrelNames": ["index.ts","index.tsx"],
  "barrelExempt": ["src/app/**"],
  "bannedDeps": ["axios","yup","joi","valibot","superstruct","ajv"],
  "requiredFiles": [
    { "path": "wrangler.jsonc", "why": "the Worker has no deploy config without it" }
  ],
  "secrets": { "neverTracked": [".dev.vars", ".env"] },
  "shadowConfigs": [
    { "found": "lefthook.yaml", "use": "lefthook.yml", "why": "lefthook 2.x installer shadows .yaml" },
    { "found": "vitest.config.ts", "use": "vite.config.ts", "why": "a vitest config replaces rather than merges" }
  ]
}
```

`src.nested` is a **glob-keyed allowlist**: the key matches a directory relative
to `srcRoot`, the value lists the only subdirectories permitted inside it. A key
ending `/*` applies to every direct child — which is how "intra-domain shape"
(D2) is expressed without a separate mechanism. Directories with no matching key
are unconstrained.

**Omitted means unconstrained; empty array means nothing is allowed.** The two
are deliberately different, and the Rust stack depends on it: its module names
are arbitrary, so it omits `src.topLevel` entirely rather than shipping `[]`,
which would reject every module in the crate. `schema.json` marks `topLevel`
optional and every other key required, so a typo'd key is a hard exit 3 (AC-8)
rather than a silent fallback.

`version` is checked, not merely stored: `run.sh` compares it against the
version baked into the scripts and prints a one-line warning to stderr when the
config trails, **without failing**. A stale copy should nag, not block a project
from committing (decision-record Risk 2).

`testGlob` is load-bearing rather than cosmetic: marketing deliberately matches
`.test.tsx` as well as `.test.ts` because an interactive React island is a
documented option there, and a gate that only saw `.test.ts` would let a
misplaced component test through.

### Per-stack values

| | console | expo | backend-ts | marketing | rust |
| --- | --- | --- | --- | --- | --- |
| `srcRoot` | `src` | `src` | `src` | `src` | `src` |
| `topLevel` | app · ui · features · api · utilities · providers · constants · types | ui · features · api · utilities · providers · constants · types | rpc · routes · services · utilities · constants · types | pages · layouts · sections · ui · content · utilities · constants · types | *(unconstrained — module names are arbitrary)* |
| `nested` | `features/*`, `ui`, `api` | `features/*`, `ui`, `api` | `rpc`, `routes`, `services` → `__tests__` | `ui` → theme, `__tests__` | `*` → `tests` |
| `testDir` | `__tests__` | `__tests__` | `__tests__` | `__tests__` | `tests` |
| `testGlob` | `*.test.ts(x)` | `*.test.*` | `*.test.ts` | `*.test.ts(x)` | `*.rs` |
| `barrelExempt` | `src/app/**` | *(none)* | *(none)* | *(none)* | n/a |
| `requiredFiles` | — | — | `wrangler.jsonc` | `src/pages/404.astro` | — |
| `secrets.neverTracked` | `.env` | `.env` | `.dev.vars` | `.env` | — |
| `fileSize.max` | 300 | 300 | 300 | 300 | 500 |
| `fileSize.skipExtensions` | `.ts .tsx` | `.ts .tsx` | `.ts` | `.ts` *(not `.astro`)* | *(none — no linter owns it)* |
| `functionSize.max` | 50 (`.tsx` 80) | 50 (`.tsx` 80) | 50 | 50 | 100 |

Expo exempts no barrels because its router lives at `app/` in the repo root,
outside `srcRoot` — so unlike console, *every* `index.ts(x)` under `src/` is a
genuine barrel. Marketing omits `.astro` from `skipExtensions` for the reason
given above: oxlint cannot see past the frontmatter, so guardrails is the only
enforcer of an `.astro` file's size.

Expo's router directory is `app/` at the **repo root**, not under `src/` — it is
outside `srcRoot` and therefore not in `topLevel`. Backend-ts and marketing have
no domain root, so D2's intra-domain rule degrades to the `nested` keys shown;
Rust has modules rather than domains, so its rule is "a module folder holds `.rs`
parts and a `tests/` sibling, nothing else".

### Function-size ceilings, from measurement

Measured with ast-grep 0.45.0 over the kit's own reference components
(`stacks/expo/templates/ui/*`, `features/home/screens/*`, `console/templates/src/*`),
counting non-blank non-comment lines exactly as `max-lines-per-function`
does with `skipBlankLines` + `skipComments`:

| | code lines |
| --- | --- |
| `Button` (4 variant maps, press states, a11y) | 41 |
| `TextInput` (label + error state) | 40 |
| `HomeScreen` | 11 |
| p50 across all 9 functions | 4 |
| over 50 | **0 of 9** |

So 50 clears the kit's most elaborate primitive with ~20% headroom, and `.tsx`
gets 80 — roughly double the observed maximum. These are deliberately loose
starting values: Risk 1 makes a false positive far more expensive than a missed
one, and a ceiling is cheap to tighten once real project data exists. Rust keeps
clippy's own default of 100.

### `.claude/settings.json` shipped into each project

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "bash scripts/guardrails/run.sh --hook" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "command", "command": "bash scripts/guardrails/run.sh --stop" }]
    }]
  }
}
```

`--stop` is repo mode plus two early-outs, both exit 0: `git diff --quiet HEAD`
(nothing changed this turn — conversational turns never pay for it) and
`stop_hook_active: true` on stdin (already continuing from a block, so do not
re-block). Claude Code hard-overrides after 8 consecutive blocks, so the loop is
bounded by the harness regardless.

### Initial ast-grep rule set

`sgconfig.yml` at the project root points at `scripts/guardrails/patterns/`.
Four rules at v1, each one already stated as prose in a `STRUCTURE.md` or
`DESIGN.md`:

| Rule | Language | What it catches |
| --- | --- | --- |
| `no-bare-fetch` | ts, tsx | `fetch(...)` outside `utilities/http.ts` — auth, baseUrl and timeouts live in one place |
| `no-hardcoded-hex` | ts, tsx | a `#rrggbb` literal outside `ui/theme/` — DESIGN.md's tokens-not-literals rule |
| `no-manual-orpc-key` | ts, tsx | a hand-written array query key beside an `orpc.` call — the key derives from the procedure path |
| `no-direct-env-var` | rust | `std::env::var(...)` outside the config module — mirrors the TS no-`process.env`-outside-`env.ts` rule |

ast-grep ships as a `@ast-grep/cli` devDependency on TS stacks (consistent with
knip and jscpd, already invoked through `bunx`; verified working at 0.45.0) and
as a documented binary install for Rust.

### Files changed per stack (D4, full migration)

Delete `templates/scripts/check-structure.sh`; add `templates/scripts/guardrails/**`,
`templates/guardrails.config.json`, `templates/sgconfig.yml`,
`templates/.claude/settings.json`. Update `SETUP.md` (§0 prereqs gain `jq` and
ast-grep; the scaffold steps gain the copies), `STRUCTURE.md` (the tree and the
_Enforced by:_ lines), `CLAUDE.md.template` (gate commands), `lefthook.yml`,
`.github/workflows/ci.yml`, and `package.json`'s `check` script. Kit-level:
`CORE.md` moves from four guard-rail layers to five, `README.md` follows, and
`scripts/validate-templates.sh` gains the copy-drift, declaration-agreement, and
no-lingering-reference assertions.

## Acceptance criteria

- **AC-1:** `run.sh` against `__tests__/fixtures/clean/` exits 0 and prints
  nothing to stderr. Every check must be silent on a correct tree.
- **AC-2:** `run.sh` against `__tests__/fixtures/violating/` exits 1 and reports
  a violation from **each** of the nine checks, each line matching
  `guardrails[<id>] <path>: <problem> — <remedy>`. The remedy clause is
  asserted, not just the problem: an agent told only what is wrong retries
  blindly.
- **AC-3:** The violating fixture carries **exactly one** violation per check,
  so removing it silences that check's output and no other. This is what makes
  each check independently provable, and it constrains the fixture's design.
- **AC-4:** `run.sh --file <path>` on a violating file in the fixture reports the
  same violation as repo mode, and on a clean file exits 0. Set-level checks
  produce no output in `--file` mode.
- **AC-5:** `run.sh --hook` fed a real `PostToolUse` JSON payload on stdin (the
  documented shape, with `tool_input.file_path` pointing at a violating fixture
  file) exits **2** and writes the violation to stderr.
- **AC-6:** `run.sh --stop` exits 0 when `git diff --quiet HEAD` is true, and
  exits 0 when stdin carries `stop_hook_active: true`, even with violations
  present in the tree. With neither early-out satisfied and violations present,
  it exits **2** — asserted explicitly, because an exit of 1 here would leave
  the Stop layer inert while appearing wired up.
- **AC-7:** With `jq` absent from `PATH`, `run.sh` exits **3** with a message
  naming `jq` and how to install it — never 0, never 1.
- **AC-8:** A `guardrails.config.json` missing a required key, or carrying an
  unknown key, causes exit **3** naming the key. The guardrail fails closed.
- **AC-9:** `folder-tree.sh` fires on a `src/features/<domain>/utils/` directory
  (not in `nested["features/*"]`) and on a `features/<domain>/` lacking a
  README, against the real violating fixture.
- **AC-10:** `file-size.sh` counts code lines only: a fixture file of 400 lines
  that is 250 code lines plus 150 blank/comment lines passes at `max: 300`, and
  one with 301 code lines fails.
- **AC-11:** `patterns.sh` fires `no-bare-fetch` on a fixture calling `fetch()`
  in a feature file and stays silent on the same call inside
  `src/utilities/http.ts`.
- **AC-12:** `validate-templates.sh` fails if any stack's `scripts/guardrails/`
  copy differs byte-for-byte from the kit's copy manifest (`run.sh`, `lib/`,
  `checks/`, `patterns/`, `schema.json` — `__tests__/` is excluded by design);
  if `.oxlintrc.json`'s `max-lines` or `max-lines-per-function` disagrees with
  that stack's `guardrails.config.json`; or if `check-structure.sh` is
  referenced anywhere under `stacks/`, `scripts/`, `CORE.md`, `README.md`, or
  `.github/`. **The search excludes `docs/toolu/`** — this spec and the decision
  record both name the file they replace, and an assertion that failed on its
  own design docs would be a self-inflicted red gate. `scripts/` is *included*
  because `validate-templates.sh` itself currently names `check-structure.sh` in
  an error message.
- **AC-13:** Every stack's `guardrails.config.json` validates against
  `schema.json`, asserted in the kit's CI.
- **AC-14:** Latency measured against a **generated tree of 500 source files
  across 20 feature folders** — fixture-sized trees prove nothing about a real
  repo. Repo mode under 2s, `--file` mode under 250ms. The generator is part of
  the test suite so the number is reproducible.
- **AC-19:** A malformed ast-grep rule causes exit **3** naming the failure —
  never a silent green. Asserted by dropping a broken rule file into
  `patterns/` and confirming the run fails closed.
- **AC-16:** `required-files.sh` fires on a marketing fixture missing
  `src/pages/404.astro` and a backend fixture missing `wrangler.jsonc`.
- **AC-17:** `secrets.sh` fires when `.dev.vars` is tracked by git in the
  fixture repo, and stays silent when it exists untracked and gitignored. The
  fixture needs a real `.git` directory — this check reads `git ls-files`, so it
  cannot be exercised against a bare directory tree.
- **AC-18:** `run.sh` prints a one-line stderr warning and still **exits 0**
  when `guardrails.config.json`'s `version` trails the scripts' version; a
  stale copy nags without blocking.
- **AC-15 (docs in sync):** `CORE.md` describes five guard-rail layers with the
  hook layer specified; `README.md`'s guard-rails paragraph matches; every
  stack's `STRUCTURE.md` _Enforced by:_ lines name `guardrails` rather than
  `guardrails`; `docs/conventions.html` reflects the new layer.

## Open Questions

1. **Function-size enforcement for `.astro`.** oxlint sees only frontmatter and
   ast-grep has no Astro grammar, so a component's template body is unenforced.
   File size is covered by `checks/file-size.sh`; function size is not. *Owner:
   falconiere — accept the gap for v1, or drop `functionSize` from the marketing
   stack config entirely so it doesn't imply coverage it lacks.*
2. **`@ast-grep/cli` via `bunx` warns** `postinstall script did not run; falling
   back to runtime binary resolution` and adds per-invocation overhead. As a
   real devDependency with a normal `bun install` this should not appear —
   confirm during execution, and if it persists, pin the binary path in the
   `check` script. *Owner: falconiere.*
3. **Whether the `Stop` hook should run the full gate or guardrails only.**
   Guardrails only, per this spec. Running `bun run check` on Stop would catch
   type errors and dead exports too, but takes seconds rather than milliseconds
   and would make every turn-end expensive. *Owner: falconiere — revisit after
   the latency data from AC-14.*
4. **Rust `bannedDeps` is empty.** No banned crates are currently declared
   anywhere in the kit. The key ships empty rather than absent so the shape stays
   uniform across stacks. *Owner: falconiere — populate when a real one appears.*
5. **`no-hardcoded-hex` cannot see `globals.css`.** ast-grep has no CSS grammar
   in the rule set we ship, so a raw hex in the one global stylesheet is
   unenforced. Low impact — `globals.css` is the documented "band seam" where
   token values are legitimately materialised. *Owner: falconiere — accept, or
   add a grep-based exception for that single file.*

## Review

Reviewed 2026-08-04 against the `spec-review` checklist. Five blockers found and
closed: `--stop` missing from the `run.sh` contract; `--stop` exiting 1 rather
than 2 (which would have left the Stop layer inert while appearing wired up);
the committed-secrets check dropped by the migration; the required-file checks
(marketing's 404, backend's `wrangler.jsonc`) dropped by the migration; and
AC-12 asserting a string that its own design docs contain. Six should-fixes
closed: file-size double-enforcement, the omitted-vs-empty `topLevel`
distinction, `testGlob`, `barrelExempt` per stack, `version` behavior, and a
latency budget that had been written against trees too small to mean anything.
The check inventory grew from seven to nine as a result. **Status: Approved.**

## Implementation notes — where the build departed from this spec

Recorded during `execution-review` so the spec stays the contract rather than a
historical document.

1. **Ten checks, not nine.** `filename-case` was added after re-reading the Rust
   stack's script: nothing else enforces `snake_case` for `.rs`, and oxlint's
   `unicorn/filename-case` covers only TypeScript. Dropping it would have been
   the same class of regression as `required-files` and `secrets`. The key is
   omitted on the TypeScript stacks so the rule keeps exactly one enforcer.
2. **No project-root `sgconfig.yml`.** The module carries its own at
   `scripts/guardrails/patterns/sgconfig.yml`, so a generated project needs no
   root config — one fewer template and one fewer surface that can drift.
3. **Pattern rule set changed.** `no-manual-orpc-key` was dropped: it cannot
   distinguish a legitimate hand-written `queryKey` for a third-party query from
   an oRPC one, and a rule that fires on correct code is the expensive failure
   (Risk 1). `no-inline-test-module` (Rust) was added in its place, recovered
   from the Rust script's `#[cfg(test)] mod` check. Five rule files ship.
4. **Rust `testGlob` is empty, not `*.rs`.** The per-stack table was wrong: Rust
   identifies tests by directory, not filename, and `*.rs` would have demanded
   every source file live in `tests/`.
5. **`utilities/http.ts` carries a scoped `max-lines-per-function: off`
   override.** Measuring every function in the kit (not just the components
   sampled for the ceiling) found `createHttpClient` at 95 code lines against a
   `.ts` p90 of **13**. It is a lone outlier, so it gets an explicit exception
   rather than a ceiling loose enough to swallow it. *Follow-up: split
   `createHttpClient` and remove the override.*
6. **AC-19 added.** `patterns.sh` originally swallowed ast-grep's exit code, so
   one malformed rule file silenced every pattern check while the gate stayed
   green. It now distinguishes ast-grep's contract (0 = clean, 1 = matched,
   anything else = broken) and exits 3. A regression test covers it.

## Amendment — consolidating on OXC (2026-08-04)

The original split gave the bash module every structural rule. That was wrong by
this spec's own principle: oxlint already has each source file open and parsed,
so any rule that is a *fact about a source file* belongs there, and a second
bash pass over the same tree is a second enforcer waiting to drift.

**Moved into oxlint**, as the house plugin at `scripts/guardrails/oxlint-plugin/`:
`folder-tree` (including intra-domain shape), `colocated-tests`, `no-barrels`,
`no-bare-fetch`, `no-hardcoded-hex`. `filename-case` was already covered by
`unicorn/filename-case`. The plugin reads the same `guardrails.config.json`, so
"one declaration" survives the split.

**Stayed in bash**, because oxlint never lints these files: `banned-deps`,
`shadow-configs`, `required-files`, `secrets`, and `file-size` for `.astro`/`.rs`.
Ten checks became five.

**Rust keeps everything in bash.** oxlint cannot parse Rust, so `ownedByLinter`
is empty there and all ten checks still run — including the ast-grep patterns.
ast-grep is consequently a **Rust-only** prerequisite now; the four TypeScript
stacks dropped the `@ast-grep/cli` devDependency entirely.

Three things this surfaced, all caught by the kit's own gate:

1. The plugin rules were not scoped to `srcRoot`, unlike the bash checks they
   replaced (which all walked `find $srcRoot`). Unscoped, `no-barrels` read
   Expo's root-level `app/index.tsx` **routes** as barrels and `no-hardcoded-hex`
   fired on a legitimate literal in `app.config.ts`.
2. `config.js` re-threw without `cause`, which the stacks' own
   `preserve-caught-error` rule rejects.
3. The plugin must default-export and must use `process`, both of which the
   house rules ban. Each is now an explicit, scoped override with its reason —
   the plugin runs in the linter's node process, not in workerd.

*Open risk:* oxlint's `jsPlugins` is documented as **alpha**. Verified
empirically that a missing or throwing plugin fails the lint run (exit 1, clear
error) rather than passing quietly, so the failure mode is safe; the API surface
may still shift.

