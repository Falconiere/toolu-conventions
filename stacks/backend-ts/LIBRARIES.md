# Library Reference

The curated toolbox for backend-ts services. The philosophy is **lean**: Bun and
Hono cover most of what a small service needs, so every extra dependency must earn
its place, do one job well, and not duplicate the runtime. Reach for Bun's
built-ins (`Bun.serve`, `bun:sql`, `bun test`, native `.env` loading, `fetch`,
`crypto`, `Intl`) before adding anything.

Install pure-JS deps with **`bun add`** (runtime) / **`bun add -d`** (dev).

---

## Baseline — installed by `SETUP.md` in every service

| Concern | Library | Notes |
| --- | --- | --- |
| HTTP framework | `hono` | Tiny, fast, Web-standard `Request`/`Response`. Runs natively on Bun. |
| Runtime + package manager | `bun` | Also the test runner (`bun test`) and `.env` loader. No Node, no dotenv. |
| Types | `@types/bun` | Bun globals (`Bun`, `process`) for `tsc`. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Git hooks | `lefthook` | Pre-commit lint + format on staged files. |

`bun test` is the built-in runner — no Jest/Vitest install. It reads `[test]` in
`bunfig.toml`, supports `describe`/`test`/`expect` out of the box, and runs
`*.test.ts` files. Exercise routes with Hono's `app.request('/path')` (no socket
needed) and assert on the real response.

---

## Reach-for-these — add when the service needs them

The **approved** choice for their job. The setup guide asks whether to wire the
DB, auth, and logging ones; add the rest as features demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Structured logging | **`pino`** | Opt-in. When you need JSON logs with levels/redaction for aggregation. Create `src/utilities/logger.ts` exporting one configured instance; log through it in services. Pair with Hono's built-in `logger()` middleware for request lines. Until then, `console.warn`/`console.error` is fine. |
| SQL / ORM | **`drizzle-orm`** | Opt-in. When you want typed schema + migrations over raw SQL. For simple Postgres access, Bun's built-in **`bun:sql`** (`import { sql } from 'bun:sql'`) needs no dependency at all — start there; reach for Drizzle when the schema and query surface grow. |
| Dates | `date-fns` **or** `Intl` | `Intl.DateTimeFormat` / `Intl.NumberFormat` (built-in) for formatting; add `date-fns` (tree-shakeable, immutable) only when you need real date math (`differenceInHours`, `addDays`, parsing). |

---

## AVOID — and why

Do not add these without an explicit, documented reason.

| Library | Avoid because | Use instead |
| --- | --- | --- |
| `express` | A Node-era framework with its own req/res model; slower on Bun and duplicates what Hono does with Web-standard types. | `hono` — it covers routing, middleware, and body parsing, natively on Bun. |
| `nest` (NestJS) | Heavy DI/decorator framework, large runtime and conceptual weight unjustified for a lean service. | `hono` + plain `services/` functions; add structure only as the app grows. |
| `zod` (and `yup`/`joi`/`valibot`) **app-wide** | A parallel runtime type system to maintain across the whole app; the baseline validates env + external data by hand (`unknown` + type guards). | Hand-written type guards. **Exception:** request-body validation **at a route boundary** is fine if you opt into it — keep the schema scoped to that route, never an app-wide layer, and never for env parsing. |
| `dotenv` / `dotenv-cli` | Bun loads `.env` (and `.env.local`, `.env.<APP_ENV>`) natively; a dep here does nothing but add noise. | Bun's native `.env` loading + `src/constants/env.ts` for validation. |

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` with attribution + a test) over an npm dependency when the
library is tiny (a few functions), unmaintained, or you only need a slice of it.
Treat vendored code as ours: lint it, type it, test it. Don't vendor anything with
native bindings — those must be real dependencies.
