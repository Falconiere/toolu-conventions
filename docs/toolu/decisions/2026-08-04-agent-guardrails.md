# agent-guardrails — Decision Record

**Date:** 2026-08-04   **Status:** Agreed, not yet specced   **Author:** falconiere
**Topic:** A named, shared, self-tested guard-rail module replacing the five per-stack `check-structure.sh` scripts
**Next phase:** `spec` (this work is cross-cutting and multi-session — it warrants a written contract)

## Intent

> Extract the per-stack `check-structure.sh` scripts into a single named
> `agent-guardrails` module in the kit — config-driven, self-tested, copied into
> every generated project — and fill the gaps it exposes (function length,
> intra-domain folder shape, code patterns), wired to fire at edit time through
> Claude Code hooks as well as at commit and CI time.

## What we found first

Most of the requested checks already have an enforcer. The gap is not coverage,
it is **ownership**: the non-lint checks live as five hand-written bash scripts
(`stacks/*/templates/scripts/check-structure.sh`, 45–80 lines each) with
overlapping logic, no shared config, and no tests. The `lefthook.yaml` check is
duplicated in all five; banned-deps in four. Expo's is 45 lines against
marketing's 80 — the drift has already begun.

| Requested check | Enforcer today | Verdict |
| --- | --- | --- |
| File size (code lines, comments/blanks excluded) | oxlint `max-lines` 300 (`skipBlankLines` + `skipComments`); rust `check-structure.sh` awk at 500 | Covered |
| Lint / format | oxlint `--deny-warnings` + oxfmt; rustfmt + clippy `-D warnings` | Covered |
| Function max lines | — | **Gap.** oxlint ships `max-lines-per-function` (pedantic: `max`, `skipBlankLines`, `skipComments`, `IIFEs`); clippy ships `too_many_lines`. A config line, not a script. |
| Folder structure by domain | `check-structure.sh` checks the *top-level* `src/` set, READMEs, barrels, colocated tests | **Partial.** Nothing inspects the inside of a feature folder. |
| Patterns | oxlint `no-restricted-imports`; `grep` for banned deps in `package.json` | **Partial.** oxlint has no `no-restricted-syntax`, so shape-level rules have no enforcer at all. |

## Decisions

### D1 — Shared kit folder, copied into each project

`guardrails/` at the kit root is the single source of truth. Each generated
project receives `scripts/guardrails/` (verbatim copy) plus a
`guardrails.config.json` holding that stack's data. Stack differences become
**data, not code**.

*Why:* zero runtime dependencies, works for the Rust stack, and preserves the
kit's stated "no CLI, no generator" design. `validate-templates.sh` fails if any
stack's copy drifts from the source, so the five copies cannot diverge again.

*Rejected:* **per-stack, as today** — every new rule written five times, and the
drift is already visible. **A published CLI package** — adds a dependency to
every project, breaks the Rust stack (no bun), needs publishing infrastructure,
and contradicts the kit's design.

*Residual cost:* a project scaffolded before a guardrails update keeps the old
copy until re-copied. Mitigated by a `version` field (see Risk 2).

### D2 — Intra-domain folder shape, enforced

Inside `src/features/<domain>/`, only the sanctioned subfolders may appear, each
domain carries its README, and stray directories fail. Today only the *top* level
of `src/` is checked, so a feature folder can contain anything.

```
src/features/shifts/
├── screens/       ✓        ├── __tests__/     ✓
├── components/    ✓        ├── types.ts       ✓
├── hooks/         ✓        ├── utils/         ✗ use hooks/ or src/utilities/
├── api/           ✓        └── (no README)    ✗
```

*Why:* it is the half of "structure" a linter structurally cannot see, and the
half agents get wrong most often — inventing a `utils/` or `helpers/` folder
inside a feature is the single most common drift from `STRUCTURE.md`.

*Not chosen:* **layer dependency direction** (partly covered by oxlint
`no-restricted-imports` today) and a **declared domain registry** — both are
sound, both are follow-ups once the module has a home.

### D3 — ast-grep for pattern enforcement

A rules directory of ast-grep YAML, run via `sgconfig.yml`, joins the gate.

*Why:* real AST matching rather than text matching, and **one syntax across TS,
TSX and Rust** — so the Rust stack gets pattern enforcement it can never get
from oxlint. Single static binary, no per-project runtime dependency. It also
expresses the rules that matter here, which are all contextual: *"bare `fetch`,
except inside `utilities/http.ts`"* is not a grep.

*Rejected:* **grep/awk** — false-positives on strings and comments, and cannot
express the "except inside" clause that every one of these rules needs.
**Deferring patterns to the AI review layer** — non-deterministic, and arrives
at PR time rather than edit time.

*Consequence:* ast-grep becomes a hard prerequisite. TS stacks add
`@ast-grep/cli` as a devDependency (consistent with knip and jscpd, both already
run through `bunx`); the Rust stack documents the binary install. Both go into
`SETUP.md` §0 prereqs and every `ci.yml`.

### D4 — Full migration, not a parallel gate

`agent-guardrails` **replaces** `check-structure.sh` in all five stacks. This
touches every `SETUP.md`, `STRUCTURE.md`, `CLAUDE.md.template`, `lefthook.yml`,
`ci.yml`, plus `CORE.md` and `validate-templates.sh`.

*Why:* two overlapping enforcers is precisely how the ceilings drift apart, and
"migrate later" reliably becomes never. The diff is large but mechanical.

*Rejected:* **add alongside** — keeps the duplication this work exists to kill.
**One stack first** — slowest to full coverage, and the config format is the
thing most likely to be designed wrong, which one stack won't reveal.

### D5 — `guardrails.config.json`, read with `jq`

```json
{
  "$schema": "./scripts/guardrails/schema.json",
  "version": 1,
  "src":  { "topLevel": ["app","ui","features","api","utilities","providers","constants","types"],
            "featureDirs": ["screens","components","hooks","api","__tests__"] },
  "fileSize":     { "max": 300, "overrides": { "src/ui/theme/*.ts": 500 } },
  "functionSize": { "max": 50 },
  "bannedDeps":   ["axios","yup","joi","valibot","superstruct","ajv"]
}
```

*Why:* every other config in a generated project is JSON (`.oxlintrc.json`,
`knip.json`, `.jscpd.json`) — this invents no new idiom. A `$schema` means an
agent editing it is validated rather than guessing. Per-glob overrides are
natural. `jq` is preinstalled on GitHub-hosted runners, so CI is unaffected;
`run.sh` fails with an install hint when it is absent.

*Rejected:* **shell variables sourced by bash** — zero dependencies, but a
typo'd variable name (`GR_FILEMAX` for `GR_FILE_MAX`) makes the check silently
fall back to its default. A guardrail that **fails open** is worse than no
guardrail, because you stop looking at it.

### D6 — `PostToolUse` + `Stop` hooks in every generated project

Committed to `.claude/settings.json` so every agent in the repo inherits them.

```
PostToolUse (matcher Edit|Write) → run.sh --hook    ~ms, the one edited file
  reads tool_input.file_path from stdin; exit 2 puts the message in front of
  the agent. Cannot block (the write landed), but it is fixed in the same turn.

Stop                             → run.sh           full repo
  early-out: git diff --quiet HEAD  → exit 0 (nothing changed this turn)
  early-out: stop_hook_active       → exit 0 (already continuing from a block)
  exit 2 → the agent keeps working instead of handing over red code
```

*Why:* `PostToolUse` alone can only ever see one file, so the violations that
emerge from the *set* — a feature folder with no README, a test outside
`__tests__/`, a newly shadowing config — would survive until CI, which is the
gap that prompted this work. `Stop` is one of the events that genuinely blocks,
making the CORE rule *never advance while anything is red* a mechanism rather
than prose.

*Runaway risk is capped by the harness, not by our script:* Claude Code
overrides the hook and ends the turn after **8 consecutive blocks**, and
`stop_hook_active` is passed in so the script can tell it is already in a
continuation.

*Rejected:* **`PreToolUse`** — it can block the write outright, but it sees only
proposed content, and refusing a write on a size ceiling before the agent has
anywhere to put the split is hostile.

**This is a new guard-rail layer, not a replacement.** `.claude/settings.json`
hooks fire for Claude Code agents only — never for a human in an editor. Lefthook,
the gate, and CI all remain mandatory. `CORE.md` moves from four layers to five,
with hooks slotting in directly after `CLAUDE.md` as the earliest feedback point.

## Architecture

```
guardrails/                          # kit source of truth
├── run.sh                           # modes: (bare) repo-wide │ --file <path> │ --hook (stdin JSON)
├── checks/
│   ├── folder-tree.sh               # top-level src set + intra-domain shape + READMEs
│   ├── file-size.sh                 # code lines, for what the linters cannot see
│   ├── colocated-tests.sh           # no centralized dirs; siblings only
│   ├── no-barrels.sh
│   ├── banned-deps.sh               # package.json / Cargo.toml
│   ├── shadow-configs.sh            # lefthook.yaml, second vitest config
│   └── patterns.sh                  # wraps `ast-grep scan`
├── patterns/                        # ast-grep rule YAML, per language
├── schema.json                      # JSON Schema for guardrails.config.json
└── __tests__/fixtures/{clean,violating}/

<generated project>/
├── scripts/guardrails/              # verbatim copy of the above
├── guardrails.config.json           # the stack's data
├── sgconfig.yml
└── .claude/settings.json            # PostToolUse + Stop (committed)
```

**Every check must be file-addressable.** This falls out of D6, not from the
gate: a hook firing on each edit cannot afford a whole-repo scan. Checks that
are meaningfully per-file (size, filename case, placement, patterns) accept
`--file`; the set-level ones (READMEs, banned deps, shadow configs, colocated
tests) run only in repo mode.

### One declaration, the best enforcer per language

The config **declares** the number; enforcement is **delegated** to whichever
tool sees that language best; the kit's own CI **proves** they agree. This is
what prevents the two-ceilings-drifting failure that D4 exists to avoid.

| Rule | Declared in | Enforced by (TS) | Enforced by (Rust) |
| --- | --- | --- | --- |
| File size | `fileSize.max` | oxlint `max-lines` | `checks/file-size.sh` |
| Function size | `functionSize.max` | oxlint `max-lines-per-function` | clippy `too_many_lines` (`clippy.toml`) |
| Folder shape | `src.*` | `checks/folder-tree.sh` | `checks/folder-tree.sh` |
| Banned deps | `bannedDeps` | oxlint `no-restricted-imports` + `checks/banned-deps.sh` | `checks/banned-deps.sh` |
| Patterns | `patterns/*.yml` | ast-grep | ast-grep |

`validate-templates.sh` gains assertions that `.oxlintrc.json`'s `max-lines` and
`max-lines-per-function` values, and `clippy.toml`'s `too-many-lines-threshold`,
each equal the corresponding `guardrails.config.json` value.

### Tested against real fixtures

`guardrails/__tests__/fixtures/` holds a **clean** project tree and a
**violating** one. Every check must fire on the violating fixture and stay
silent on the clean one, asserted in the kit's own CI. This is the house
real-data rule applied to the guardrails themselves — and Risk 1 makes it
non-optional rather than nice-to-have.

## Open risks

1. **A false positive in the `Stop` hook costs up to 8 blocked turns.** The
   harness caps the loop, but a wrong check is expensive and the CORE rule
   forbids disabling it to get moving. *Mitigation:* the two-fixture test above
   is a hard requirement — no check ships without proof it stays silent on clean
   code.
2. **Copy-drift on existing projects.** A project scaffolded today keeps its
   guardrails copy forever. *Mitigation:* `version` in both the config and the
   scripts; `run.sh` warns (does not fail) when the config version trails.
3. **Gate latency.** `bun run check` already runs seven steps. Repo-wide
   guardrails must stay well under a second, or people route around the gate.
   Budget it in the spec and measure it.
4. **A new hard prerequisite (ast-grep) across five stacks and CI.** Every
   `SETUP.md` §0, every `ci.yml`, and the Rust stack's non-bun install path.
5. **A missed reference during the full migration** leaves a project invoking a
   `check-structure.sh` that no longer exists. *Mitigation:*
   `validate-templates.sh` must fail on any lingering reference to that filename
   anywhere in the kit.
6. **`functionSize.max: 50` will fire constantly on `.tsx`.** A legitimate React
   component with JSX routinely exceeds 50 lines, and `max-lines-per-function`
   counts the JSX body. A single global ceiling is very likely wrong here.
   *Likely resolution:* a per-glob override (tighter for `.ts`, looser for
   `.tsx`), decided with real numbers rather than by taste. **Settle this in the
   spec — it is the decision most likely to make the whole layer feel hostile.**
7. **The domain-shape model does not transfer to every stack.** `rust` has no
   `features/` concept (modules, not domains) and `marketing` is Astro
   pages/content. `featureDirs` is config-driven, but rust needs a different
   model, not different values.

## For the spec to settle

- The per-stack `featureDirs` values, and what the domain-shape check *means*
  for `rust` and `marketing` (Risk 7).
- The function-size ceilings, per glob, backed by measurements against a real
  console codebase (Risk 6).
- Whether `expo`'s `app/` router directory changes its intra-domain shape.
- The exact `run.sh --hook` stdin contract and its per-check `--file` routing.
- The initial ast-grep rule set — start small, with rules that already exist as
  prose in `STRUCTURE.md` (`no-bare-fetch`, no hand-written query keys beside an
  oRPC call, no interface declared beside a Zod schema).
- The latency budget for repo-wide mode (Risk 3).
