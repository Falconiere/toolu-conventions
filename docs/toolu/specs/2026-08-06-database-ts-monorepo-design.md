# database-ts stack & kit monorepo capability — Design

**Date:** 2026-08-06   **Status:** Approved   **Author:** Falconiere R. Barbosa
**Topic:** A sixth stack that scaffolds the database as an isolated workspace package, and the monorepo capability the kit needs to host it.

## Problem

Every backend-ts service today puts its database access in `src/db/` inside the
API (`stacks/backend-ts/STRUCTURE.md:59`), so schema, migrations, and the Turso
client are entangled with routes and procedures. Changing the storage engine
means editing the API; nothing marks where the database ends and the service
begins. We want that boundary to be a real package with a declared surface, so
swapping the engine is a change inside one package instead of a diff across the
service.

The kit cannot host that today. It documents "no monorepo support" as a v1
non-goal in two specs, and its enforcement module is single-root by
construction: `srcRoot` is a scalar and `gr_load_config` reads
`guardrails.config.json` from the current directory
(`guardrails/lib/config.sh:23`).

## Non-Goals

1. **Not repository ports.** The package exports a configured client and the
   schema; the API writes its own queries. Drizzle's types cross the package
   boundary deliberately — see the trade-off in Architecture.
2. **Not a published package.** `@<project>/database` is workspace-internal.
   No registry, no version bumps, no release process.
3. **No build step.** The package's `exports` point at TypeScript source. The
   only consumer is a Worker that bundles anyway.
4. **Cargo workspaces stay out of scope.** The Rust stack remains single-crate
   (`stacks/rust/STRUCTURE.md:9`).
5. **No migration path for already-scaffolded projects.** This is kit-forward:
   new projects get the layout, existing ones are untouched.
6. **better-auth's tables do not move.** It keeps generating and migrating its
   own schema in the API package.
7. **`srcRoot` does not become an array.** Multi-root configs are the rejected
   mechanism; per-package configs are the chosen one.
8. **Only one workspace template pair ships.** The mechanism is general — any
   stack may be a workspace package — but this change ships templates for
   `backend-ts` + `database-ts` only.

## Architecture

### The connector depth, and its cost

The package exports `createDatabase(config)` and the schema tables. The API
imports both and writes Drizzle queries against them.

The trade-off that drove this: **cheapness and retained type inference over
total isolation.** Repository ports (domain functions in, domain shapes out)
would fully deliver "swap the engine, the API is unaffected", at the cost of a
hand-written function per access pattern and Drizzle's inference discarded. We
took the cheaper boundary and accept that isolation is **partial**: ordinary
CRUD survives an engine swap, but dialect-specific calls
(`onConflictDoUpdate`, `returning()`, `sqliteTable` vs `pgTable` inferred
column types) still break API call sites. The package README must state this
rather than promise a clean swap.

### Package surface without a barrel

The kit bans `index.ts` re-export barrels (CORE; `backend-ts` rule 1). A
`package.json` `exports` map satisfies both requirements at once by pointing
subpaths straight at concrete files. No `barrelExempt` entry, no lint
exemption.

`src/schema/tables.ts` is not a barrel either, on the same grounds
`stacks/backend-ts/STRUCTURE.md:228` gives for `rpc/router.ts`: it composes a
value whose shape *is* the schema, and Drizzle's relational queries require
that value.

### Guardrails in a workspace

The three wired invocations all run with the working directory at the repo
root: `PostToolUse` and `Stop` from `shared/.claude/settings.json`, and
lefthook's `{staged_files}`. Since `gr_load_config` runs unconditionally before
mode dispatch (`guardrails/run.sh:126`), a workspace root with no
`guardrails.config.json` makes all three exit 3 — enforcement layers 2 and 3
dead while looking wired up. So workspace support is a **module change**, not a
convention.

The mechanism:

- A **`guardrails.workspace.json`** at the workspace root lists the package
  directories and carries the repo-level checks that have no source tree
  (`bannedDeps`, `secrets`, `shadowConfigs`, `requiredFiles`). It has no
  `srcRoot` and no `src` key.
- It therefore needs **its own schema and its own key set**. The existing
  `guardrails/schema.json` is `additionalProperties: false` and requires
  `srcRoot`, `src`, `fileSize`, `functionSize`, `testDir`, `testGlob` and
  `barrelNames` — a manifest validated against it is rejected outright, and
  `gr_load_config`'s unknown-key rule (`guardrails/lib/config.sh:37-43`) would
  reject `packages` as a typo. So: a new `guardrails/workspace.schema.json`,
  and in `config.sh` a second pair of key lists —
  `GR_WS_REQUIRED_KEYS='version packages'`, optional
  `$schema bannedDeps secrets shadowConfigs requiredFiles` — selected by which
  file is present. Both files present at the root is ambiguous and exits 3.
- The filename matters. The oxlint plugin resolves `guardrails.config.json`
  from `process.cwd()` too (`guardrails/oxlint-plugin/config.js:15-18`), so a
  root file under that name would let a root-level oxlint run lint both
  packages against one config and silently disable the five `ownedByLinter`
  checks. Under a name the plugin never looks for, a root-level oxlint run
  instead throws at plugin load — it already fails closed
  (`guardrails/oxlint-plugin/config.js:22-27`). **The absent
  `guardrails.config.json` at the root is itself the enforcement.**
- `run.sh` re-execs itself once per package (`cd "$pkg" && "$GR_DIR/run.sh"`)
  rather than looping in-process. Config values are cached into globals by
  `gr_cache_config`, so a second package in the same process would inherit the
  first one's ceilings and allowlists. Re-exec also lets `ownedByLinter` differ
  per package.
- In `--file` and `--hook` mode, paths arrive root-relative and may span
  packages — lefthook expands `{staged_files}` across the whole commit. Workspace
  mode **buckets the paths by owning package and re-execs once per bucket**,
  passing each child only the paths it owns, rewritten package-relative.
- Fails closed on the ambiguous cases, each exiting 3: a listed package with no
  `guardrails.config.json`; a listed package directory absent from disk; an
  empty `packages` array; a package path containing `..`; a package that exists
  but is not listed (found in repo mode, or via a `--file` path inside it); and
  both `guardrails.config.json` and `guardrails.workspace.json` at the root.

  A `--file` path at the workspace **root** is explicitly *not* one of them.
  Rejecting every unowned path looks like the fail-closed choice and is not:
  lefthook expands `{staged_files}` across the whole commit, so staging
  `package.json` would exit 3 and block it. That is a broken hook, not a guard
  rail — and there is no file-addressable check at a root to run anyway. The
  property worth keeping is that a *forgotten package* never passes, which the
  ancestor-config walk preserves.
- Checks themselves are **unchanged**. Each runs with the working directory
  already inside its package, which is the single-root case they were written
  for.
- Because the child's working directory *is* the package, `gr_violation` emits
  package-relative paths (`src/foo.ts`) with nothing to say which package. The
  parent passes **`GR_PATH_PREFIX`** to each child and `lib/report.sh` prepends
  it, so a workspace run reports `packages/database/src/foo.ts`. Unset in the
  single-repo case, where output is unchanged.

`GR_SCRIPTS_VERSION` **stays at 1**. Workspace support is purely additive — a
single-root config behaves identically — and bumping it would make every
already-scaffolded project emit the "re-copy `scripts/guardrails/`" warning
(`guardrails/lib/config.sh:45-49`) for a feature it does not use.

### The other gate steps in a workspace

CORE makes knip and jscpd non-optional, so both need an answer here.

**knip** is the one that breaks by default. The backend-ts template declares
`entry: ["src/index.ts", "vitest.config.ts"]`, and `packages/database`
deliberately has no `src/index.ts` — knip would find no entry point, call every
export unused, and fail the gate. The database package's `knip.json` therefore
declares the three `exports` targets as its entries:

```jsonc
{
  "entry": [
    "src/client/create-database.ts",
    "src/schema/tables.ts",
    "src/types/database.ts",
    "vitest.config.ts",
    "drizzle.config.ts"
  ],
  "project": ["src/**/*.ts"]
}
```

The API's knip is unchanged, but the root `package.json` declares knip's
`workspaces` so `@<project>/database` resolves as a workspace dependency rather
than an unlisted import.

**jscpd** stays per-package, `path: ["src"]` as today, run through the same
`bun --filter` fan-out. Consequence worth stating: duplication *between*
packages — a schema type mirrored near the API boundary — is not seen by either
run. Accepted; the alternative is a root run that reports every legitimate
shared shape.

**`.dev.vars`** is read by wrangler beside each `wrangler.jsonc`, so a workspace
has two. The database package's holds only `TURSO_URL` and `TURSO_AUTH_TOKEN`;
the API's holds those plus everything else it needs. Duplicated deliberately —
a symlink is invisible in review and breaks on Windows checkouts. The workspace
manifest's `secrets.neverTracked` must list **both** paths, or the untracked
check covers one file and silently ignores the other.

### Scaffold flow

Root `SETUP.md` gains a `database-ts` row in the stack table and one intake
question under backend-ts: *separate database package?* Answering yes scaffolds
a workspace — root first (`package.json` `workspaces`,
`guardrails.workspace.json`, lefthook, CI), then `packages/database`, then
`packages/api` — and replaces backend-ts Phase 6c.

The table and intake question 1 legitimately disagree, and the docs must say so
rather than look inconsistent: the kit has **six stacks**, but only **five are
directly choosable**. `database-ts` is reachable solely through the backend-ts
sub-question and is never scaffolded alone — a database package with no
consumer has no gate, no bindings, and nothing to be typed against.

## Interfaces / Schema

### Package tree

```
packages/database/
├── src/
│   ├── client/          # create-database.ts — the factory. README.md
│   │   └── __tests__/
│   ├── schema/          # one file per table + tables.ts. README.md
│   │   └── __tests__/
│   ├── constants/       # env.ts — Zod-parsed database config. README.md
│   └── types/           # README.md
├── drizzle/             # drizzle-kit migration output
├── drizzle.config.ts · wrangler.jsonc · vitest.config.ts
├── package.json · guardrails.config.json · tsconfig.json
├── .oxlintrc.json · .oxfmtrc.json · knip.json · .jscpd.json
└── CLAUDE.md · README.md
```

`src.topLevel` for this stack: `client schema constants types`. No `app.ts`, no
`index.ts`, no `src/index.ts` — the package has no entry point, only exports.
Its `guardrails.config.json` mirrors backend-ts's, with `barrelExempt` dropped
(nothing to exempt) and its own `requiredFiles`:

```jsonc
"requiredFiles": [
  { "path": "drizzle.config.ts", "why": "without it the schema has no migration path" }
]
```

### The public surface

```jsonc
// packages/database/package.json
{
  "name": "@<project>/database",
  "exports": {
    "./client": "./src/client/create-database.ts",
    "./schema": "./src/schema/tables.ts",
    "./types": "./src/types/database.ts"
  }
}
```

```ts
// packages/database/src/client/create-database.ts
import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql/web';
import type { DatabaseConfig } from '@/constants/env';
import { tables } from '@/schema/tables';

/** Build a database handle for one request. Never call this at module scope. */
export function createDatabase(config: DatabaseConfig) {
  const client = createClient({ url: config.url, authToken: config.authToken });
  return drizzle(client, { schema: tables });
}
```

```ts
// packages/database/src/types/database.ts
export type Database = ReturnType<typeof createDatabase>;
```

A module-level `drizzle(...)` or `createClient(...)` is a bug on workerd, where
an isolate is shared across requests
(`stacks/backend-ts/STRUCTURE.md:19`). This is enforced by a new ast-grep rule
under `guardrails/patterns/`, not left to review.

### Consumption from the API

```ts
// packages/api/src/services/shift-service.ts
import { createDatabase } from '@<project>/database/client';
import { shifts } from '@<project>/database/schema';
import { eq } from 'drizzle-orm';

export async function listShiftsForLocation(env: Env, locationId: string) {
  const database = createDatabase({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
  return database.select().from(shifts).where(eq(shifts.locationId, locationId));
}
```

`drizzle-orm` is a direct dependency of both packages — the API needs its
operators. `src/db/` disappears from the backend-ts tree when this option is on.

### `guardrails.workspace.json`

```jsonc
{
  "$schema": "./scripts/guardrails/workspace.schema.json",
  "version": 1,
  "packages": ["packages/api", "packages/database"],
  "bannedDeps": ["axios", "yup", "joi", "valibot", "superstruct", "ajv"],
  "secrets": {
    "neverTracked": ["packages/api/.dev.vars", "packages/database/.dev.vars"]
  },
  "shadowConfigs": [
    { "found": "lefthook.yaml", "use": "lefthook.yml",
      "why": "the lefthook 2.x installer shadows a .yaml, so the hooks never run" }
  ]
}
```

Root gate: `bun --filter '*' run check`, with oxlint fanned out the same way so
each run's `process.cwd()` is its own package.

### `drizzle.config.ts`

```ts
export default {
  dialect: 'turso',
  schema: './src/schema/tables.ts',
  out: './drizzle',
  // better-auth owns these and migrates them itself; drizzle-kit push must not
  // see them as drift and drop them.
  tablesFilter: ['!user', '!session', '!account', '!verification'],
};
```

## Acceptance criteria

Every criterion below is exercised by the existing real-data harnesses:
`guardrails/__tests__/run-fixtures.sh` builds real git repos on disk via
`lib/mkrepo.sh` and runs the real `run.sh` against them, and
`scripts/validate-templates.sh` parses and type-checks the actual shipped
templates. No mocks, no fixtures-in-memory.

- **AC-1:** Repo mode from a workspace root with two real packages, one holding
  a folder-tree violation, exits 1 and reports the path prefixed by its package
  (`packages/database/src/…`), via `GR_PATH_PREFIX`. The same fixture run
  single-repo reports the unprefixed path — the prefix appears only in
  workspace mode.
- **AC-2:** Each of the five fail-closed cases exits 3, asserted separately: a
  listed package with no `guardrails.config.json`; a listed package directory
  absent from disk; an empty `packages` array; a changed file under no listed
  package; both `guardrails.config.json` and `guardrails.workspace.json` at the
  root.
- **AC-3:** `--file` with a staged set spanning both packages runs both, with
  each package's checks seeing only its own paths, package-relative. A staged
  set of workspace-root files exits 0 rather than blocking the commit, while a
  path inside an unlisted package still exits 3.
- **AC-4:** `run.sh --hook` invoked from the workspace root with a real
  PostToolUse payload naming a violating file inside `packages/database` exits
  2 and reports that file's violation.
- **AC-5:** `run.sh --stop` from a workspace root over a dirty, violating tree
  exits 2; over a clean tree exits 0.
- **AC-6:** Two packages with different `fileSize.max` each get their own
  ceiling in one root-mode run — proof the re-exec isolates cached config.
- **AC-7:** Root-level checks still fire from the workspace manifest: `axios`
  in the root `package.json` exits 1, and a git-tracked root `.dev.vars` exits 1.
- **AC-8:** A package that declares a check in `ownedByLinter` skips it while
  the sibling package that does not declare it still runs it, in the same root
  invocation.
- **AC-9:** `run.sh --list` still prints 13 check ids — workspace support is
  dispatch, not a new check — and `validate-templates.sh` still asserts that
  count.
- **AC-10:** Running `oxlint` from the workspace root exits nonzero with a
  plugin-load failure, because no `guardrails.config.json` exists there;
  `bun --filter '*' run lint` exits 0.
- **AC-11:** Every `stacks/database-ts/templates/` JSON parses, its TypeScript
  templates lint and type-check, and the stack passes the same per-stack
  template assertions the other five do in `validate-templates.sh`
  (lines 339, 390, 520, 531, 544).
- **AC-12:** `guardrails --only no-barrels` over a scaffolded
  `packages/database` is clean, and no `index.ts` exists anywhere under its
  `src/`.
- **AC-13:** The new ast-grep pattern rule flags a module-level
  `createDatabase()`/`drizzle()` call in a real fixture file and passes the
  in-function form.
- **AC-14:** A scaffolded `packages/database` runs its own tests inside workerd
  against a real Turso database — a schema round-trip (insert, select back)
  through `createDatabase`, no mocked client.
- **AC-15:** Docs in sync, asserted not just written: the README badge and
  prose stack count, `docs/index.html`, `docs/conventions.html`,
  `docs/how-it-works.html`, and the root `SETUP.md` stack table all read six
  stacks, and `validate-templates.sh` fails if that count disagrees with
  `ls stacks/`.
- **AC-16:** `CORE.md` carries a monorepo section stating the per-package
  config rule, the no-root-`guardrails.config.json` rule and why, and the
  per-package oxlint fan-out.
- **AC-17:** Both prior specs
  (`docs/toolu/specs/2026-07-17-conventions-kit-design.md:15`,
  `docs/toolu/specs/2026-08-04-agent-guardrails-design.md:34`) are marked
  superseded on the no-monorepo non-goal, with a pointer to this spec.
- **AC-18:** `stacks/backend-ts/` no longer documents `src/db/` as the database
  home when the separate-package option is taken, and its `LIBRARIES.md`
  database row points at the package.
- **AC-19:** `knip` over a scaffolded `packages/database` exits 0 — its three
  `exports` targets are recognised as entries and no export is reported unused
  — and `knip` over `packages/api` does not report `@<project>/database` as an
  unlisted dependency.
- **AC-20:** A real `guardrails.workspace.json` validates against
  `guardrails/workspace.schema.json` and is rejected by it when `packages` is
  missing; a single-repo `guardrails.config.json` still validates against
  `guardrails/schema.json` unchanged.
- **AC-21:** `stacks/database-ts/SETUP.md` references every file shipped in
  `stacks/database-ts/templates/`, asserted by the per-stack loop at
  `scripts/validate-templates.sh:390`.
- **AC-22:** Every `.dev.vars` path named in the workspace manifest's
  `secrets.neverTracked` is enforced: git-tracking either
  `packages/api/.dev.vars` or `packages/database/.dev.vars` exits 1.

## Open Questions

1. **Does `@cloudflare/vitest-pool-workers` boot for a Worker-less library
   package?** The pool reads a `wrangler.jsonc`, but `packages/database` has no
   Worker entry. If a minimal config does not satisfy it, the fallback is plain
   Vitest in Node against real Turso — `@tursodatabase/serverless` is
   fetch-only, so it runs there, but AC-14 would then be "real data, not the
   real runtime". *Owner: spike in the first execution step, before templates
   are written.*
2. **Migration ordering against one Turso database.** better-auth's migrator
   and drizzle-kit both target it; `tablesFilter` stops drizzle clobbering auth
   tables, but first-run ordering is undefined. *Owner: resolve during `plan`;
   likely a documented order in the human checklist rather than automation.*
