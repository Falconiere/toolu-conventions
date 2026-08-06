# SETUP — database-ts

You are scaffolding the **database package** of a workspace. You do not run this
file on its own: the `backend-ts` kit dispatches here when the operator answers
**yes** to *separate database package?*. A database package with no consumer has
no gate, no bindings and nothing to be typed against.

Read [`STRUCTURE.md`](./STRUCTURE.md) and [`LIBRARIES.md`](./LIBRARIES.md) first.
Templates live in [`templates/`](./templates/) under their real filenames; only
`CLAUDE.md.template` is suffixed — rename it to `CLAUDE.md` when copying.
Substitute `<project-name>` with the intake project name everywhere it appears.

Set the anchors once, then every path below resolves:

```bash
KIT=/path/to/toolu-conventions   # this kit
ROOT=$(pwd)                      # the workspace root
```

## Phase 1 — the workspace root

Only if `$ROOT` is not already a workspace. Run from `$ROOT`:

```bash
cp "$KIT/shared/workspace/package.json"              ./package.json
cp "$KIT/shared/workspace/guardrails.workspace.json" ./guardrails.workspace.json
cp "$KIT/shared/workspace/knip.json"                 ./knip.json
cp "$KIT/shared/workspace/lefthook.yml"              ./lefthook.yml
mkdir -p scripts
cp -R "$KIT/guardrails" ./scripts/guardrails
rm -rf ./scripts/guardrails/__tests__
mkdir -p .claude && cp "$KIT/shared/.claude/settings.json" .claude/settings.json
```

Substitute `<project-name>` in `package.json`.

> **There must be no `guardrails.config.json` at `$ROOT`.** The oxlint plugin
> resolves that filename from the working directory, so one here would let a
> root-level lint run check every package against it and silently disable the
> five checks each package declares `ownedByLinter`. Its absence makes a
> root-level run fail closed instead. `guardrails.workspace.json` is a different
> document with a different schema; the gate exits 3 if both are present.

## Phase 2 — the package

From `$ROOT`:

```bash
mkdir -p packages/database
cp -R "$KIT/stacks/database-ts/templates/." packages/database/
mv packages/database/CLAUDE.md.template packages/database/CLAUDE.md
mv packages/database/base.oxlintrc.json packages/database/.oxlintrc.json
```

Then, inside `packages/database`:

1. Substitute `<project-name>` in `package.json`, `wrangler.jsonc` and `CLAUDE.md`.
2. `bun install` from `$ROOT` (workspaces install together).
3. Copy `.dev.vars.example` to `.dev.vars` and `.env.example` to `.env`, and
   fill in the Turso URL and token. Both are git-ignored; the gate fails if
   either is ever tracked.

## Phase 3 — the schema

`src/schema/user-table.ts` ships a `profiles` example. Replace it with the real
tables, one file each, and register every one in `src/schema/tables.ts`.

Do **not** add better-auth's `user`, `session`, `account` or `verification`
tables. It owns and migrates them itself against the same database;
`drizzle.config.ts` filters them so `drizzle-kit push` cannot read them as drift
and offer to drop them.

## Phase 4 — migrations

```bash
bun run db:generate    # writes drizzle/
bun run db:migrate     # applies it
```

`drizzle/` is generated and committed. Never hand-edit it.

Ordering matters on a fresh database, and it is not automated: run
**better-auth's** migrator first (`npx auth migrate` in the API package), then
this one. Two migrators against one database is the cost of letting better-auth
keep its own tables; the alternative was hand-maintaining its generated schema.

## Phase 5 — wire the API

In `packages/api/package.json`, add the workspace dependency:

```jsonc
"dependencies": {
  "@<project-name>/database": "workspace:*",
  "drizzle-orm": "^0.45.2"
}
```

`drizzle-orm` is a **direct** dependency of the API too — it needs the operators
(`eq`, `and`, …) to write queries. Services then import from the package:

```ts
import { createDatabase } from '@<project-name>/database/client';
import { profiles } from '@<project-name>/database/schema';
```

`packages/api/src/db/` must not exist. That directory is what this package
replaces; if the backend-ts scaffold created one, delete it and move anything in
it here.

## Phase 6 — the gate

From `$ROOT`:

```bash
bun --filter '*' run check
```

Every package must be green. If you are tempted to run `oxlint` from `$ROOT` to
debug a failure: don't — see Phase 1. Run it inside the package.

## Human checklist

Print these; do not attempt them:

- Create the Turso database and generate an auth token.
- Fill `.dev.vars` and `.env` in `packages/database`.
- Run the first migration against the real database, better-auth's migrator
  first.
- Confirm the round-trip test in `src/client/__tests__/` passes against it —
  this is the one check CI cannot do for you, because the kit has no
  credentials.
