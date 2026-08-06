# database-ts stack & kit monorepo capability — Plan

**Date:** 2026-08-06   **Status:** Approved   **Spec:** docs/toolu/specs/2026-08-06-database-ts-monorepo-design.md   **Topic:** Add a sixth stack that scaffolds the database as an isolated workspace package, and the guardrails workspace support it needs.

## Context

Database access today lives in `src/db/` inside the API, so schema, migrations
and the Turso client are entangled with routes and procedures. We want a real
package boundary. The kit cannot host one: its enforcement module is
single-root, and the three wired invocations (`PostToolUse`, `Stop`, lefthook
`{staged_files}`) all run with the working directory at the repo root, where a
workspace has no `guardrails.config.json` — all three would exit 3 and leave
enforcement layers 2 and 3 dead while looking wired up.

## Approach

Two changes, in dependency order. **First** teach `guardrails/` about
workspaces, because every later step is gated by it. **Then** add the
`database-ts` stack that the capability makes possible.

Workspace support is deliberately narrow: a root `guardrails.workspace.json`
lists the packages, and `run.sh` re-execs itself once per package with the
working directory inside it, so **every existing check runs unmodified** in the
single-root case it was written for. The re-exec (rather than an in-process
loop) is what keeps `gr_cache_config`'s globals from bleeding one package's
ceilings into the next.

Reused as-is, not reinvented: `guardrails/lib/config.sh` fail-closed loading,
`guardrails/lib/report.sh` violation formatting, the real-git-repo fixture
harness at `guardrails/__tests__/lib/mkrepo.sh`, and the per-stack template
loops in `scripts/validate-templates.sh`.

Workspace-root templates go in `shared/workspace/`, next to the existing
cross-stack sources (`shared/folder-README.md`, `shared/.claude/settings.json`)
— one source, on purpose, since the root is shared by both packages.

## Steps / workstreams

**A — guardrails workspace support.** The enabling change; nothing else lands
until the fixture suite is green with it. `run.sh` gains dispatch only; the
thirteen check ids are untouched, so `--list` still prints 13.

**B — the `database-ts` stack.** Templates, three stack docs, and one new
ast-grep rule banning a module-level `drizzle()`/`createDatabase()` — a shared
isolate makes that a real bug on workerd, so it is enforced, not reviewed.

**C — backend-ts integration and kit docs.** `src/db/` stops being the database
home when the option is on; six stacks everywhere the count appears; both prior
specs marked superseded on the no-monorepo non-goal.

**D — the validator.** Last, because its new assertions (stack count matches
`ls stacks/`, no root `guardrails.config.json` in the workspace templates) only
become true once C has landed.

## Steps (machine-readable)

```json
[
  {
    "id": "spike-vitest-pool",
    "title": "Spike: does @cloudflare/vitest-pool-workers boot for a Worker-less library package?",
    "check": "grep -qE '^\\*\\*Verdict:\\*\\* (workerd|node-fallback)$' docs/toolu/spikes/2026-08-06-vitest-pool-library-package.md",
    "ac_refs": ["AC-14"],
    "model": "sonnet",
    "input": "Spec Open Question 1. Build a throwaway package with a minimal wrangler.jsonc and no Worker entry, run one real Turso round-trip through it. Record the verdict and, if it fails, the plain-Vitest-in-Node fallback. Blocks the database-ts vitest.config.ts and CLAUDE.md test guidance."
  },
  {
    "id": "ws-schema",
    "title": "Add guardrails/workspace.schema.json",
    "check": "jq -e '.additionalProperties == false and (.required | index(\"packages\"))' guardrails/workspace.schema.json >/dev/null",
    "ac_refs": ["AC-20"],
    "model": "sonnet",
    "input": "Mirror guardrails/schema.json's style. Required: version, packages. Optional: $schema, bannedDeps, secrets, shadowConfigs, requiredFiles. No srcRoot, no src, no fileSize."
  },
  {
    "id": "ws-config",
    "title": "Teach config.sh to load a workspace manifest",
    "check": "bash -n guardrails/lib/config.sh && bash guardrails/__tests__/run-fixtures.sh",
    "ac_refs": ["AC-2", "AC-20"],
    "model": "sonnet",
    "depends_on": ["ws-schema"],
    "input": "Second key set GR_WS_REQUIRED_KEYS='version packages' plus the optional list, selected by which file is present. Both files at the root exits 3. Empty packages array exits 3. GR_SCRIPTS_VERSION stays 1 — do not bump it."
  },
  {
    "id": "ws-report-prefix",
    "title": "Prepend GR_PATH_PREFIX in report.sh",
    "check": "bash -n guardrails/lib/report.sh && bash guardrails/__tests__/run-fixtures.sh",
    "ac_refs": ["AC-1"],
    "model": "haiku",
    "input": "Unset in the single-repo case, so existing output stays byte-identical — the fixture suite is the regression check."
  },
  {
    "id": "ws-dispatch",
    "title": "Add workspace dispatch in lib/workspace.sh, sourced by run.sh",
    "check": "bash -n guardrails/run.sh guardrails/lib/workspace.sh && bash guardrails/__tests__/run-fixtures.sh",
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "model": "opus",
    "depends_on": ["ws-config", "ws-report-prefix"],
    "input": "The hard step: exit-code semantics differ per mode (hook must exit 2, repo 1, misconfig 3) and the parent owns stdin. Parent parses the payload, buckets root-relative paths by owning package, re-execs with package-relative paths and GR_PATH_PREFIX, then aggregates. Root-level repo checks (bannedDeps, secrets, shadowConfigs, requiredFiles) run from the manifest in the parent. A path under no listed package exits 3. Bucketing, re-exec and aggregation live in a new guardrails/lib/workspace.sh rather than inline — run.sh is already ~170 lines and the module has an established lib/ split (config.sh, report.sh); inlining would push it past the 300 ceiling."
  },
  {
    "id": "ws-fixtures",
    "title": "Workspace fixtures and assertions in the guardrails suite",
    "check": "bash guardrails/__tests__/run-fixtures.sh",
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8", "AC-9", "AC-22"],
    "model": "sonnet",
    "depends_on": ["ws-dispatch"],
    "input": "Real git repos via lib/mkrepo.sh, no mocks. Needs a two-package workspace fixture where the packages carry DIFFERENT fileSize.max (proves re-exec isolates cached config) and different ownedByLinter (proves per-package skipping). AC-4 needs a real PostToolUse payload on stdin asserting exit 2 — that is the only coverage enforcement layer 2 gets. Assert --list still prints exactly 13."
  },
  {
    "id": "ws-latency",
    "title": "Extend the latency budget to a workspace tree",
    "check": "bash guardrails/__tests__/run-latency.sh",
    "ac_refs": [],
    "model": "sonnet",
    "depends_on": ["ws-dispatch"],
    "input": "Re-exec adds one process spawn per package. Assert the 500-file budget still holds when that tree is split across two packages; if it does not, the dispatch is wrong, not the budget."
  },
  {
    "id": "ws-docs",
    "title": "Document workspace mode in guardrails/README.md",
    "check": "grep -q 'guardrails.workspace.json' guardrails/README.md && grep -q 'GR_PATH_PREFIX' guardrails/README.md",
    "ac_refs": [],
    "model": "haiku",
    "depends_on": ["ws-dispatch"]
  },
  {
    "id": "pattern-module-scope",
    "title": "oxlint plugin rule banning a module-level drizzle()/createDatabase() call",
    "check": "bash guardrails/__tests__/run-plugin.sh",
    "ac_refs": ["AC-13"],
    "model": "sonnet",
    "input": "guardrails/oxlint-plugin/rules/no-module-scope-database.js, registered in index.js beside no-bare-fetch and no-hardcoded-hex. NOT guardrails/patterns/ — that tree holds rust/ and sgconfig.yml only, and every TS stack declares `patterns` in ownedByLinter, so a bash pattern rule would never fire on the stack it exists for. Fixture must cover both sides: module scope flagged, in-function form clean."
  },
  {
    "id": "kit-ci",
    "title": "Run the oxlint plugin suite in the kit's own CI",
    "check": "grep -q 'run-plugin.sh' .github/workflows/ci.yml && bash guardrails/__tests__/run-plugin.sh",
    "ac_refs": ["AC-13"],
    "model": "haiku",
    "depends_on": ["pattern-module-scope"],
    "input": "ci.yml runs run-fixtures, run-latency and validate-templates but never run-plugin.sh, so every oxlint plugin rule — including the new one — is currently untested by the gate. Add the step next to the other two guardrails jobs."
  },
  {
    "id": "workspace-root-templates",
    "title": "Workspace root templates under shared/workspace/",
    "check": "bash scripts/validate-templates.sh",
    "ac_refs": ["AC-19", "AC-22"],
    "model": "sonnet",
    "depends_on": ["ws-schema"],
    "input": "package.json (bun workspaces + knip workspaces key), guardrails.workspace.json with BOTH .dev.vars paths in secrets.neverTracked, lefthook.yml, ci.yml. No guardrails.config.json at the root — its absence is what makes a root-level oxlint run fail closed."
  },
  {
    "id": "db-templates",
    "title": "stacks/database-ts/templates/",
    "check": "bash scripts/validate-templates.sh",
    "ac_refs": ["AC-11", "AC-12", "AC-19"],
    "model": "sonnet",
    "depends_on": ["spike-vitest-pool", "workspace-root-templates"],
    "input": "package.json exports map (the public surface, no barrel), guardrails.config.json (topLevel client/schema/constants/types, requiredFiles drizzle.config.ts, no barrelExempt), knip.json with the exports targets as entries, .jscpd.json (path src, threshold 0, exitCode 1), drizzle.config.ts with tablesFilter excluding better-auth's tables, wrangler.jsonc, vitest.config.ts per the spike, tsconfig, lint configs, CLAUDE.md.template, README.md, and the src skeleton with a README in every folder."
  },
  {
    "id": "db-stack-docs",
    "title": "stacks/database-ts/ STRUCTURE.md, LIBRARIES.md, SETUP.md",
    "check": "bash scripts/validate-templates.sh",
    "ac_refs": ["AC-21"],
    "model": "sonnet",
    "depends_on": ["db-templates"],
    "input": "SETUP.md must reference every shipped template. STRUCTURE.md states the partial-isolation caveat plainly: dialect-specific calls still break API call sites."
  },
  {
    "id": "backend-ts-integration",
    "title": "Rework backend-ts for the separate-package option",
    "check": "bash scripts/validate-templates.sh",
    "ac_refs": ["AC-18"],
    "model": "sonnet",
    "depends_on": ["db-stack-docs"],
    "input": "STRUCTURE.md drops src/db/ as the database home; SETUP.md Phase 6c becomes a dispatch to database-ts; LIBRARIES.md database row points at the package. better-auth keeps its own tables — say so where the auth integration is described."
  },
  {
    "id": "core-monorepo",
    "title": "CORE.md monorepo section",
    "check": "grep -q 'guardrails.workspace.json' CORE.md && grep -q 'bun --filter' CORE.md",
    "ac_refs": ["AC-16"],
    "model": "sonnet",
    "depends_on": ["ws-dispatch"],
    "input": "Per-package config rule, the no-root-guardrails.config.json rule AND why, the per-package oxlint fan-out."
  },
  {
    "id": "root-setup",
    "title": "Root SETUP.md: stack table, intake sub-question, workspace scaffold order",
    "check": "grep -q 'database-ts' SETUP.md && grep -q 'packages/database' SETUP.md",
    "ac_refs": ["AC-15"],
    "model": "sonnet",
    "depends_on": ["backend-ts-integration"],
    "input": "Six stacks in the table, five directly choosable. Say explicitly that database-ts is reachable only via the backend-ts sub-question, so the table and intake list differ on purpose. Scaffold order: root, then packages/database, then packages/api."
  },
  {
    "id": "kit-docs",
    "title": "README, the three docs/*.html pages, and superseding both prior specs",
    "check": "grep -q 'stacks-6' README.md && grep -q 'database-ts' README.md && grep -q 'database-ts' docs/index.html && grep -q 'database-ts' docs/conventions.html && grep -q 'database-ts' docs/how-it-works.html && grep -q 'superseded' docs/toolu/specs/2026-07-17-conventions-kit-design.md && grep -q 'superseded' docs/toolu/specs/2026-08-04-agent-guardrails-design.md",
    "ac_refs": ["AC-15", "AC-17"],
    "model": "sonnet",
    "depends_on": ["root-setup"],
    "input": "README badge stacks-5 -> stacks-6 plus the prose count and stack table. docs/index.html, docs/conventions.html, docs/how-it-works.html. Mark the no-monorepo non-goal superseded in 2026-07-17-conventions-kit-design.md:15 and 2026-08-04-agent-guardrails-design.md:34, each pointing at this spec — supersede the one non-goal, do not rewrite the specs."
  },
  {
    "id": "validator",
    "title": "Extend scripts/validate-templates.sh for the sixth stack and the workspace rules",
    "check": "bash scripts/validate-templates.sh && bash guardrails/__tests__/run-fixtures.sh && bash guardrails/__tests__/run-latency.sh",
    "ac_refs": ["AC-9", "AC-10", "AC-11", "AC-15", "AC-21"],
    "model": "sonnet",
    "depends_on": ["kit-docs"],
    "input": "Add database-ts to the per-stack loops (lines 339, 390, 520, 531, 544 today). New assertions: documented stack count matches ls stacks/; shared/workspace/ ships no guardrails.config.json AND is wired to its consumers, mirroring the shared/folder-README.md assertion at lines 511-524; guardrails.workspace.json validates against workspace.schema.json; the 13-check assertion still holds. AC-10 specifically: run oxlint from a shared/workspace/ root fixture and assert it exits nonzero with a plugin-load failure, then assert the per-package fan-out passes — a claim about fail-closed behaviour that is never executed is not a check."
  }
]
```

## Critical files

**Create** — `guardrails/workspace.schema.json` · `guardrails/lib/workspace.sh` ·
`guardrails/oxlint-plugin/rules/no-module-scope-database.js` ·
`shared/workspace/{package.json, guardrails.workspace.json, lefthook.yml, ci.yml}` ·
`stacks/database-ts/{STRUCTURE.md, LIBRARIES.md, SETUP.md}` ·
`stacks/database-ts/templates/` (full set) ·
`docs/toolu/spikes/2026-08-06-vitest-pool-library-package.md`

**Modify** — `guardrails/run.sh` · `guardrails/lib/config.sh` ·
`guardrails/lib/report.sh` · `guardrails/README.md` ·
`guardrails/oxlint-plugin/index.js` ·
`guardrails/__tests__/{run-fixtures.sh, run-latency.sh, run-plugin.sh, lib/mkrepo.sh}` ·
`.github/workflows/ci.yml` ·
`scripts/validate-templates.sh` · `CORE.md` · `SETUP.md` · `README.md` ·
`docs/{index,conventions,how-it-works}.html` ·
`stacks/backend-ts/{STRUCTURE.md, SETUP.md, LIBRARIES.md}` ·
`docs/toolu/specs/{2026-07-17-conventions-kit-design.md,
2026-08-04-agent-guardrails-design.md}`

## Verification

The gate is the CI job, which this change extends from three commands to four:
`guardrails/__tests__/run-fixtures.sh`, `guardrails/__tests__/run-latency.sh`,
`guardrails/__tests__/run-plugin.sh` (added by `kit-ci` — the plugin suite
exists today but CI never ran it, so every oxlint house rule was untested by
the gate), and `scripts/validate-templates.sh`. All four must be green before
the PR opens, and the fixture suite must be green after **every** workstream-A
step, not just at the end — a single-repo regression there breaks every
already-scaffolded project.

Real data, no mocks: the fixture suite builds actual git repositories on disk
via `lib/mkrepo.sh` and runs the real `run.sh` against them;
`validate-templates.sh` parses and type-checks the actual shipped templates.
The new workspace fixtures are real two-package trees.

**One acceptance criterion CI cannot cover.** AC-14 — a scaffolded
`packages/database` doing a real Turso round-trip inside workerd — needs
credentials this repo does not have and a project this repo does not scaffold.
It is verified once, by hand, during `spike-vitest-pool`, against a real Turso
database; the recorded spike note is the evidence. Everything downstream of it
(the `vitest.config.ts` template, the CLAUDE.md test guidance) is a template
whose correctness rests on that one manual run. Say so in the PR rather than
implying the gate proves it.
