# Project Structure & Conventions

The canonical layout of the **database package** — the sixth stack, and the only
one that is never scaffolded alone. It inherits the stack-agnostic rules in
[`../../CORE.md`](../../CORE.md) and the workspace rules there; this file adds
the specifics of a library package that runs on workerd.

## What this stack is for

Pulling the database out of the API so schema, migrations and the client live in
one place with a declared surface, instead of inside `src/db/` next to routes
and procedures.

It ships as a Bun workspace package alongside `backend-ts`:

```
<project>/
├── package.json                # workspaces: ["packages/*"]
├── guardrails.workspace.json   # names the packages — NOT guardrails.config.json
├── packages/api/               # the backend-ts stack
└── packages/database/          # this stack
```

## What the boundary buys, and what it does not

The package exports a **configured client and the schema**; the API writes its
own queries. That is a deliberate trade: it keeps Drizzle's type inference and
costs nothing per query, where repository ports (domain functions in, domain
shapes out) would give total isolation at the price of a hand-written function
per access pattern.

The consequence has to be stated plainly rather than discovered later: **Drizzle
types cross the boundary.** Ordinary CRUD survives an engine swap as a change
inside this package. Dialect-specific calls — `onConflictDoUpdate`,
`returning()`, `sqliteTable` vs `pgTable` inferred column types — do not; they
break API call sites. If you need a swap that touches nothing outside this
package, this is the wrong design and you want ports.

## Folder tree

```
packages/database/
├── src/
│   ├── client/           # create-database.ts — the per-request factory. README.md
│   │   └── __tests__/
│   ├── schema/           # one file per table + tables.ts. README.md
│   │   └── __tests__/
│   ├── constants/        # env.ts — Zod schema for caller-supplied config. README.md
│   └── types/            # database.ts — the inferred handle type. README.md
├── drizzle/              # generated migrations. Committed, never hand-edited
├── drizzle.config.ts     # dialect: 'turso', tablesFilter excludes better-auth's
├── wrangler.jsonc        # no `main` — it exists so the vitest pool can boot workerd
├── vitest.config.ts      # @cloudflare/vitest-pool-workers, tests run in workerd
├── package.json          # the `exports` map IS the public API
├── guardrails.config.json · tsconfig.json · knip.json · .jscpd.json
├── .oxlintrc.json · .oxfmtrc.json
├── .dev.vars.example     # test credentials (.dev.vars is git-ignored)
├── .env.example          # migration credentials — drizzle-kit runs in Node
├── CLAUDE.md · README.md
```

No `app.ts`, no `index.ts`, no `src/index.ts`. This package has no entry point.

## The public surface is `exports`, and that is why there is no barrel

CORE bans `index.ts` re-export barrels. A package still needs a public API, and
`package.json` `exports` gives one by pointing subpaths at concrete files:

```jsonc
"exports": {
  "./client": "./src/client/create-database.ts",
  "./schema": "./src/schema/tables.ts",
  "./types":  "./src/types/database.ts"
}
```

Both rules hold at once, with no `barrelExempt` entry. Adding a public entry
means adding a subpath, which is a visible act in review — unlike a line
appended to a barrel.

`src/schema/tables.ts` is not a barrel either, on the same grounds
[`backend-ts`](../backend-ts/STRUCTURE.md) gives for `rpc/router.ts`: it
composes a value whose shape *is* the schema, and drizzle's relational queries
need that value to exist.

## Per request, never per isolate

```ts
export function createDatabase(config: unknown) {
  const { url, authToken } = parseDatabaseConfig(config);
  return drizzle(createClient({ url, authToken }), { schema: tables });
}
```

A Worker evaluates a module **once per isolate**, before any request, and that
isolate is shared by every request it serves. A handle built at module scope
therefore captures startup config and is shared across concurrent requests —
the same bug as a connection pool, showing up only under load. This is enforced
by `house/no-module-scope-database` in the oxlint plugin, not left to review.

Config arrives as an argument for the same reason it is validated: the package
holds no bindings, `process.env` does not exist on workerd, and the API is the
one with `c.env`.

## Hard conventions

These inherit CORE. Each names its enforcer; `(review)` means no machine check.

1. **No barrels, no `index.ts`.** Public entries go in the `exports` map. —
   `no-barrels` (`house/no-barrels`).
2. **No deep relative imports.** `@/` alias throughout. — `no-restricted-imports`.
3. **One table per file**, named after its export, registered in `tables.ts`. —
   `unicorn/filename-case` for the name; registration is (review).
4. **Allowed `src/` layout:** `client schema constants types`, each with a
   `README.md`. — `guardrails` / `house/folder-tree`.
5. **Never construct the client at module scope.** —
   `house/no-module-scope-database`.
6. **`/web` entries only.** `@libsql/client/web`, `drizzle-orm/libsql/web`; the
   defaults are Node-native. — (review), and it fails at bundle time if missed.
7. **Zod at the config boundary**, types from `z.infer`. — (review).
8. **better-auth's tables are not ours.** `drizzle.config.ts` filters `user`,
   `session`, `account`, `verification`. — `requiredFiles` guarantees the config
   exists; the filter's contents are (review).
9. **`drizzle/` is generated and committed**, never hand-edited. — (review).
10. **Co-locate tests** in a sibling `__tests__/`. — `guardrails`.
11. **Tests run in workerd against real Turso.** No mock client. —
    `vitest.config.ts` for the runtime, (review) for the mock rule.
12. **No `any`.** — `typescript/no-explicit-any`.
13. **Nothing unused.** TypeScript and oxlint reject unused locals and
    parameters, including names prefixed with `_`; root-level knip rejects an
    unused file, export, or dependency. Delete or wire dead code instead of
    suppressing the checks. — `noUnusedLocals`, `noUnusedParameters`,
    `eslint/no-unused-vars`, and `knip.json`.
14. **`max-lines: 300`**, code lines only. — `max-lines`.

## Testing

The pool boots workerd from this package's `wrangler.jsonc` even though there is
no Worker in it — verified, not assumed. Bindings come from `.dev.vars`:

```ts
import { env } from 'cloudflare:test';

const database = createDatabase({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
```

Write round-trips that clean up after themselves, so the suite can run
repeatedly against a shared development database.

## The gate, in a workspace

`bun run check` inside the package; `bun --filter '*' run check` from the root.

**Never run oxlint from the workspace root.** The house plugin resolves
`guardrails.config.json` from the working directory, and a workspace root
deliberately has none — a root-level run would either lint every package against
one config or, as configured here, fail closed at plugin load. Fan out with
`bun --filter` instead.
