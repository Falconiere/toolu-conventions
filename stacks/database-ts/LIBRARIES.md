# Library Reference

The toolbox for the database package. It is deliberately tiny: this package has
one job, and every dependency it adds is one the API inherits transitively.

**The runtime filter comes first.** This package runs on **workerd** — no native
modules, no `fs`, no Node stream internals. That rules out most of what the
libSQL and Drizzle ecosystems ship.

---

## Baseline

| Concern | Library | Notes |
| --- | --- | --- |
| ORM + schema | `drizzle-orm` | Typed schema, typed queries, and the migration story. Import from **`drizzle-orm/libsql/web`** — the default entry is Node-native. Tables from `drizzle-orm/sqlite-core`. |
| Driver | `@libsql/client` | Import from **`@libsql/client/web`** only. `fetch`-based, no native deps. |
| Migrations | `drizzle-kit` (dev) | Runs in **Node**, outside the Worker, so it reads real env vars from `.env` rather than bindings. `dialect: 'turso'`. |
| Validation | `zod` (v4) | The config boundary. Types from `z.infer`. |
| Testing | `vitest` (≥4.1) + `@cloudflare/vitest-pool-workers` | Boots workerd from this package's `wrangler.jsonc`, with no Worker entry needed. |
| Runtime tooling | `wrangler` (dev) | Loads `.dev.vars` for the test pool. This package never deploys. |
| Dead code | `knip` (dev) | Configured at the workspace root, with this package's `exports` targets as its entries — a library with no `src/index.ts` would otherwise read as entirely unused. |
| Lint / format | `oxlint` + `oxfmt` | Including the house plugin's `no-module-scope-database`. |

### Picking the right libSQL entry

| Import | What it is | Use here? |
| --- | --- | --- |
| **`@libsql/client/web`** | Remote over `fetch` | **Yes — this is the one.** |
| `@libsql/client` | Auto-selects; resolves to the Node build | No — pulls native bindings |
| `@libsql/client/node` | Explicitly Node | No |
| `@tursodatabase/serverless` | The newer remote client | Fine for raw SQL, but Drizzle's turso dialect expects the libSQL client |

The same split applies to Drizzle: `drizzle-orm/libsql/web`, never
`drizzle-orm/libsql`.

---

## AVOID — and why

| Library | Avoid because | Use instead |
| --- | --- | --- |
| `drizzle-orm/libsql` (default entry) | Node-native. The failure looks like a bundler bug, not a wrong import. | `drizzle-orm/libsql/web` |
| `@tursodatabase/database` / `@tursodatabase/sync` | Native/WASM local-database packages; cannot run on workerd. | `@libsql/client/web` |
| `better-sqlite3`, `bun:sqlite` | Native, and Bun is the package manager here, not the runtime. | `@libsql/client/web` |
| A connection pool (`pg`, `mysql2`, pool wrappers) | Workers cannot hold sockets across requests, and the isolate is shared — a pool here is a bug that appears under load. | The per-request factory. |
| A second ORM or query builder (`kysely`, `prisma`) | better-auth brings kysely for **its own** tables; that is its business, not a second ORM for ours. Two schema sources over one database is how migrations start fighting. | `drizzle-orm` |
| `dotenv` | There is no `.env` at runtime. Only `drizzle-kit` reads one, and it does so itself. | Bindings via `.dev.vars`; config passed in as an argument. |
| A hand-written `interface` beside a table | A second source of truth that drifts the first time a column changes. | `z.infer`, and drizzle's own inferred row types. |
