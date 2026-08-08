# SETUP — database-ts

> This is a derived CLI recipe, never a public `--stack` value. Select
> `--stack backend-ts --integration drizzle --integration database-package` to
> materialize `packages/api` and `packages/database` as one verified Bun
> workspace.

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
mkdir -p scripts/guardrails
# The MANIFEST, never the whole directory. __tests__/ is the kit's own suite and
# its fixtures are violating-by-design trees — copying it in and deleting it
# again leaves the deletion one edit away from being dropped.
for item in run.sh lib checks patterns schema.json workspace.schema.json oxlint-plugin; do
  cp -R "$KIT/guardrails/$item" scripts/guardrails/
done
chmod +x scripts/guardrails/run.sh
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
```

Both `.oxlintrc.json` and `base.oxlintrc.json` ship, and neither is renamed:
the thin one carries this stack's ceilings and overrides and `extends` the
shared base beside it. Renaming the base over the thin one would silently drop
every override.

Then, inside `packages/database`:

1. Substitute `<project-name>` everywhere it appears — one pass, so no file is
   missed:

   ```bash
   grep -rl '<project-name>' packages/database \
     | xargs sed -i.bak "s/<project-name>/$PROJECT_NAME/g"
   find packages/database -name '*.bak' -delete
   ```
2. `bun install` from `$ROOT` (workspaces install together).
3. Copy `.dev.vars.example` to `.dev.vars` and `.env.example` to `.env`, and
   fill in the Turso URL and token. Both are git-ignored; the gate fails if
   either is ever tracked.

## Phase 3 — the schema

`src/schema/profiles-table.ts` ships a `profiles` example. Replace it with the real
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
**better-auth's** migrator first (`npx auth@latest migrate` in the API package), then
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

Dead code has no naming escape hatch. Every package enables `noUnusedLocals` and
`noUnusedParameters`; oxlint's `eslint/no-unused-vars` rejects every unused
local or parameter (including `_name`); root-level knip checks unused files,
exports, and dependencies across the workspace. Delete or wire the code; do not
add an ignore pattern.

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
