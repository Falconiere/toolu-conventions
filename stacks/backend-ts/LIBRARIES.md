# Library Reference

The curated toolbox for backend-ts services. The philosophy is **lean**: Hono and
the Workers runtime cover most of what a small service needs, so every extra
dependency must earn its place, do one job well, and not duplicate the platform.
Reach for the runtime's own APIs (`fetch`, `crypto`, `Intl`, `URL`,
`AbortController`, Web Streams) before adding anything.

**The runtime filter comes first.** This service runs on **workerd**, so a
dependency has to work there: no native modules, no `fs`, no Node stream
internals unless `nodejs_compat` genuinely covers them. A package that is perfect
on Node can be unusable here. Check before you add.

Install with **`bun add`** (runtime) / **`bun add -d`** (dev).

---

## Baseline — installed by `SETUP.md` in every service

| Concern | Library | Notes |
| --- | --- | --- |
| HTTP framework | `hono` | Tiny, fast, Web-standard `Request`/`Response`. Built for this runtime; a Hono app *is* a valid Worker handler. |
| Typed API surface | `@orpc/server` | Procedures with Zod input **and** output schemas, mounted at `/rpc` via the fetch adapter. Our own clients are typed from these declarations. |
| Validation | `zod` (v4) | Every boundary: bindings, procedure input/output, webhook payloads. Types come from `z.infer`. |
| Dead code / unused deps | `knip` (dev) | Gate step. Fails on an unused file, export, or dependency. |
| Copy-paste detection | `jscpd` (dev) | Gate step, `threshold: 0` + `exitCode: 1`. |
| Runtime + deploy | `wrangler` (dev) | Runs the real runtime locally (`wrangler dev`), generates `Env` types, deploys, and manages secrets. |
| Package manager | `bun` | Install and script runner. **Not** the runtime and **not** the test runner here — those are workerd and Vitest. |
| Testing | `vitest` (≥4.1) + `@cloudflare/vitest-pool-workers` | Runs tests inside workerd against the project's real `wrangler.jsonc`. |
| Database | `@tursodatabase/serverless` | The house database client. `fetch`-only, zero native deps — the package Turso recommends for edge runtimes. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Git hooks | `lefthook` | Pre-commit lint + format on staged files. |

### Picking the right Turso package

Turso ships several, and only one of them runs here:

| Package | What it is | Use on Workers? |
| --- | --- | --- |
| **`@tursodatabase/serverless`** | Remote access over `fetch` | **Yes — this is the one.** |
| `@tursodatabase/database` | Local/embedded, native or WASM | No |
| `@tursodatabase/sync` | Local database + cloud sync, native | No |
| `@libsql/client` | The legacy name | Only via Drizzle, and only the `/web` entry |

A response from the client is data, not a type: validate it into your own shape
in `src/services/` rather than trusting a row's declared columns.

---

## Reach-for-these — add when the service needs them

The **approved** choice for their job. The setup guide asks whether to wire the
auth, logging, and ORM ones; add the rest as features demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Auth | **`better-auth`** (+ `@libsql/kysely-libsql` + `kysely`) | The house auth (CORE). This service owns the **server** half — sessions, providers, and the tables in Turso; the console holds only the client. Needs `nodejs_compat` (already set). Build **per request** with `betterAuth({ database, secret, baseURL, … })` from bindings — never at module scope. Schema via `npx auth@latest generate` / `migrate`. |
| ORM / migrations | **`drizzle-orm`** + `@libsql/client/web` (+ `drizzle-kit` dev) | Opt-in. When typed schema and real migrations beat hand-written SQL. Use the **`/web`** entry — the default one is Node-native and will not run on workerd. `dialect: 'turso'` in `drizzle.config.ts`. |
| Structured logging | A ~10-line `src/utilities/logger.ts` | Emit one JSON line per event via `console.warn`/`console.error`; Workers Logs indexes the fields. Keep `observability.enabled` on in `wrangler.jsonc`. Pair with Hono's built-in `logger()` middleware for request lines. |
| Outbound HTTP | Built-in `fetch`, or `src/utilities/http.ts` from the console kit | `fetch` is native here. Copy the kit's client only when you want one place for base URL, timeout, and error shaping across several calls. |
| Dates | `Intl` (built in), or `date-fns` | `Intl.DateTimeFormat` / `Intl.NumberFormat` for formatting; add `date-fns` only when you need real date math (`differenceInHours`, `addDays`, parsing). |
| Scheduled work | Cron triggers in `wrangler.jsonc` + a `scheduled` handler | The Workers-native answer to a background job. Not a library. |

---

## AVOID — and why

Do not add these without an explicit, documented reason.

| Library | Avoid because | Use instead |
| --- | --- | --- |
| `express` | A Node-era framework built on Node's `req`/`res` and its stream internals. It does not belong on workerd. | `hono` — Web-standard types, built for this runtime. |
| `nest` (NestJS) | Heavy DI/decorator framework, large runtime and conceptual weight unjustified for a lean service — and a poor fit for an isolate-per-request model. | `hono` + plain `services/` functions; add structure as the app grows. |
| **`axios`** | A dependency for something the runtime already has, with its own error model and cancellation story on top. | Built-in `fetch`, or `src/utilities/http.ts`. Blocked by lint **and** by `guardrails`. |
| **`pino`** (and other Node loggers) | Built around Node streams and transports; on Workers the platform already captures and indexes structured output. | A tiny `logger.ts` writing JSON through `console.warn`/`console.error`. |
| **`dotenv`** | There is no `.env` at runtime here. Config is bindings; local secrets come from `.dev.vars`, which wrangler loads itself. | `wrangler.jsonc` `vars` + `.dev.vars` + `src/constants/env.ts`. |
| **`@tursodatabase/database` / `@tursodatabase/sync`** | Native/WASM local-database packages. They cannot run on workerd, and the failure looks like a bundler bug. | `@tursodatabase/serverless`. |
| A connection pool (`pg`, `mysql2`, pool wrappers) | Workers cannot hold sockets across requests, and an isolate is shared — a "pool" here is a bug that shows up under load. | Per-request connections over HTTP (Turso), or Hyperdrive if you truly need Postgres. |
| `yup` / `joi` / `valibot`, or hand-written type guards | The kit has one validator, and here it is load-bearing: the same Zod schemas that validate a procedure's input and output are what type the clients. A second library means shapes that oRPC cannot see. | **`zod`** everywhere — bindings, procedure `.input()`/`.output()`, webhook bodies. |
| `trpc` | Same idea as oRPC, but the kit picked one. Running both means two clients, two conventions, and two ways to describe the same procedure. | `@orpc/server` + `@orpc/client`. |
| `bun:sql`, `bun:sqlite`, `Bun.*` anything | Bun is the package manager here, not the runtime. These APIs do not exist on workerd. | The Turso client; `wrangler dev` for local runs. |

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` with attribution + a test) over an npm dependency when the
library is tiny (a few functions), unmaintained, or you only need a slice of it.
Treat vendored code as ours: lint it, type it, test it. Don't vendor anything
with native bindings — those cannot run here at all.
