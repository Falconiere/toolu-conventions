# SETUP — New backend-ts Service (Hono on Cloudflare Workers)

**You are an AI coding agent scaffolding a Hono service that runs on Cloudflare
Workers.** Follow this guide top to bottom in an empty project directory. Work
the phases in order: Phase 0 gathers inputs, after that prefer acting over
asking. When a step references a template, read it from this kit's `templates/`
directory and adapt it (replace `{{PLACEHOLDERS}}`) — do not invent config from
memory.

**Target baseline (non-negotiable):** Cloudflare Workers (workerd) · Hono ·
TypeScript (strict) · bun as package manager · Vitest through
`@cloudflare/vitest-pool-workers` (tests run **inside the real runtime**) ·
Turso for persistence · oxlint + oxfmt · Lefthook · the layout and conventions in
[`STRUCTURE.md`](./STRUCTURE.md) · the lean library set in
[`LIBRARIES.md`](./LIBRARIES.md).

> **This is a Workers service, not a Node/Bun server.** There is no `process.env`,
> no filesystem, no long-lived connection pool, and no `Bun.serve`. Config
> arrives as **bindings**; the entry point is a **default export**; anything that
> needs a socket needs a different design. Getting this wrong is the single most
> common way an agent breaks this stack — if a library's docs say "Node.js", stop
> and check it works on workerd first.

Read [`../../CORE.md`](../../CORE.md), [`STRUCTURE.md`](./STRUCTURE.md), and
[`LIBRARIES.md`](./LIBRARIES.md) before you start.

---

## Phase 0 — Prerequisites & intake

### 0.1 Check the toolchain

```bash
bun --version    # package manager for this project
git --version    # version control
```

If `bun` is missing, install it (`curl -fsSL https://bun.sh/install | bash`) and
re-check before continuing. Wrangler is installed as a project dependency in
Phase 2 — do not install it globally.

### 0.2 Intake (the root `SETUP.md` normally passes these in)

Confirm these answers before scaffolding; ask only for what's missing:

- **Project name** — kebab-case (directory, package name, and Worker name).
- **Staging environment?** — DEV + PROD always exist; add STAGING? (default: no.)
- **Database?** — default **yes, Turso**. This kit has one database, so the
  question is whether the service needs persistence at all, not which engine.
  If yes, ask whether the Turso database already exists or a human must create
  it (Phase 5 + the final checklist).
- **Optional integrations** (each defaults to *no* — keep the baseline lean):
  - **Auth (better-auth)?** yes/no (Phase 6a).
  - **Structured logging?** yes/no (Phase 6b).
  - **Drizzle ORM** on top of Turso? yes/no — default no; the raw client is
    enough until the schema justifies migrations (Phase 6c).

Echo back the chosen options before scaffolding.

---

## Phase 1 — Scaffold the project

From the new project directory (empty):

```bash
bun init -y
bun add hono
rm -f index.ts        # the kit ships src/index.ts instead
```

---

## Phase 2 — Dev tooling & scripts

```bash
# The typed API surface and the one validator
bun add @orpc/server zod

# Runtime, deploy, and the test pool that runs tests inside workerd
bun add -d wrangler vitest @cloudflare/vitest-pool-workers

# Types, lint, format, gate, hooks
bun add -d typescript oxlint oxfmt oxlint-tsgolint knip jscpd lefthook
```

> Vitest must be **4.1 or newer** for `@cloudflare/vitest-pool-workers`. If the
> resolved version is older, pin it (`bun add -d vitest@^4.1.0`) before going on
> — an older Vitest fails with an opaque pool error.

Copy and adapt these templates into the project root (overwrite what `bun init`
generated):

- `templates/tsconfig.json` → `tsconfig.json` (strict + the `@/*` path alias +
  the Workers test types)
- `templates/wrangler.jsonc` → `wrangler.jsonc` (set `"name"` to the project
  name; keep `compatibility_flags: ["nodejs_compat"]`)
- `templates/vitest.config.ts` → `vitest.config.ts` (points the pool at
  `wrangler.jsonc`, so tests and the deploy read one config)
- `templates/.oxlintrc.json` → `.oxlintrc.json`
- `templates/.oxfmtrc.json` → `.oxfmtrc.json` (oxfmt uses single quotes — the
  house style; without this config oxfmt defaults to double quotes and the gate
  fails)
- `templates/knip.json` → `knip.json` (unused files/exports/dependencies)
- `templates/.jscpd.json` → `.jscpd.json` (copy-paste detection). **Keep
  `"exitCode": 1`** — jscpd 5.x already exits 1 on a threshold breach, so this
  pins the behaviour rather than enabling it; 4.x exited 0 by default, and the
  dependency is unpinned.
- `templates/lefthook.yml` → `lefthook.yml` (must be `.yml`, not `.yaml` — see
  the install note below)
- `templates/scripts/check-structure.sh` → `scripts/check-structure.sh`
  (`mkdir -p scripts` first; `chmod +x` it) — the structure gate that
  machine-checks what the linter can't (allowed `src/` dirs, per-folder READMEs,
  no barrel files, exactly one wrangler config, no committed `.dev.vars`, no
  banned dependency)

Set the `package.json` `scripts` block to exactly this:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types",
    "type-check": "tsc --noEmit",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "check:structure": "bash scripts/check-structure.sh",
    "check:unused": "knip",
    "check:dupes": "jscpd",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the one gate command — type-check + lint + format-check +
structure-check + knip + jscpd + test, in that order. Now install the pre-commit hooks — **the
config must already be in place** (copied in the step above) before you run this:

```bash
bunx lefthook install
```

> **Config file must be `lefthook.yml`, not `lefthook.yaml`.** Lefthook 2.x's
> `install` writes a `lefthook.yml` stub, and when both exist the `.yml` shadows
> the `.yaml` — so a `lefthook.yaml` config silently stops taking effect and hooks
> don't run. Ship the config as `lefthook.yml`; if a stub `lefthook.yml` already
> exists from a stray earlier `install`, overwrite it with the template.

Generate the Worker types and **commit them**:

```bash
bun run cf-typegen     # writes worker-configuration.d.ts from wrangler.jsonc
```

`worker-configuration.d.ts` is what gives `c.env` its `Env` type. It is
generated but committed, because `tsc --noEmit` needs it on a fresh clone. Rerun
`bun run cf-typegen` every time you add a binding, var, or secret — CI fails on
a stale copy.

---

## Phase 3 — Folder structure & source skeleton

Build the tree from [`STRUCTURE.md`](./STRUCTURE.md):

```bash
mkdir -p src/rpc/__tests__ src/routes/__tests__ src/services/__tests__ \
         src/utilities src/constants src/types
```

Then:

1. Copy `templates/env.ts` → `src/constants/env.ts` (bindings parsed with Zod;
   keep the accessor-function shape and the reason its header comment gives).
2. Copy `templates/src/app.ts` → `src/app.ts` (the Hono app, typed with
   `Bindings: Env`, plus the `/health` route).
3. Copy `templates/src/index.ts` → `src/index.ts` (`export default app` — the
   Worker's fetch handler, and the only default export in the codebase).
4. Copy `templates/.dev.vars.example` → `.dev.vars.example`; create a local
   `.dev.vars` from it. Add `.dev.vars` and `.env*` to `.gitignore` — the
   structure check fails if `.dev.vars` is ever tracked.
5. Copy `templates/src/rpc/{base,router,health-procedures}.ts` → `src/rpc/`. This
   is the typed API surface — read [`STRUCTURE.md`](./STRUCTURE.md) →
   "Procedures" before adding one.
6. Drop a `README.md` into each of `src/rpc`, `src/routes`, `src/services`,
   `src/utilities`, `src/constants`, and `src/types`, generated from
   `templates/folder-README.md`
   (fill in the folder's purpose + a short "what's inside" list — seed it now,
   keep it updated as you add files).
7. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` and fill in the app name +
   one-line description. This is the rulebook + repo map agents read first.

Add a first real test so the suite has something to run — a route test that
drives the **actual Worker** through the actual runtime (real request, real
response; no mocks):

```ts
// src/routes/__tests__/health-route.test.ts
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';

describe('GET /health', () => {
  test('returns ok', async () => {
    const response = await exports.default.fetch('http://localhost/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
```

> `exports.default.fetch()` dispatches through the real Worker entry, including
> middleware and bindings. (Older guides import `SELF` from `cloudflare:test`;
> that is deprecated — `exports` from `cloudflare:workers` is the current API.)
> Hono's `app.request('/path')` still works for a pure routing unit test, but it
> bypasses the runtime, so prefer `exports.default.fetch` for anything that
> touches config, auth, or the database.

**Conventions reminder while you build:** no barrel files, kebab-case filenames
named after their export, named exports only (`src/index.ts` is the one
exception), thin routes + services for logic, co-located `__tests__/`, no `any`,
no `console.log`.

---

## Phase 4 — Environments, config, and secrets

Workers splits config in two, and the split is a security boundary:

| Kind | Lives in | Example |
| --- | --- | --- |
| Non-secret config | `vars` in `wrangler.jsonc` (committed, reviewable) | `APP_ENV` |
| Secrets | `.dev.vars` locally, `wrangler secret put` deployed | `TURSO_AUTH_TOKEN` |

1. `src/constants/env.ts` reads bindings through `cloudflare:workers` and parses
   them with a Zod schema. Add a var by declaring it in `wrangler.jsonc` (or
   `.dev.vars`), running `bun run cf-typegen`, then validating it in `env.ts`.
2. **Never put a secret in `wrangler.jsonc`.** It is committed; `.dev.vars` is
   not, and the structure check fails if `.dev.vars` becomes tracked.
3. If STAGING was **not** requested, remove `'staging'` from the `AppEnv` union
   in `env.ts` and leave the commented `env.staging` block in `wrangler.jsonc`
   alone. If it **was**, uncomment that block — and remember each environment
   needs its own secrets (`wrangler secret put TURSO_AUTH_TOKEN --env staging`).

---

## Phase 5 — Database (Turso)

Skip only if Phase 0 said the service needs no persistence.

```bash
bun add @tursodatabase/serverless
```

`@tursodatabase/serverless` is the package to use here: it talks to Turso over
`fetch` with zero native dependencies, which is exactly what workerd supports.
(`@tursodatabase/database` and `@tursodatabase/sync` are Node/native and will not
run on a Worker. `@libsql/client` is the legacy name — only reach for it via the
Drizzle path in Phase 6c.)

Adding `src/db/` introduces a new top-level dir, so add `db` to `allowed_dirs`
in `scripts/check-structure.sh` and give it a `README.md`, or the structure gate
rejects it.

```ts
// src/db/client.ts
/** Opens a Turso connection for the current request. */
import { connect } from '@tursodatabase/serverless';
import { tursoConfig } from '@/constants/env';

// A Connection is single-stream: concurrent calls on one connection serialize.
// Open one per request rather than caching a module-level instance — a Worker
// isolate is shared across requests, and a cached connection would make
// unrelated requests queue behind each other.
export function openDb() {
  const { url, authToken } = tursoConfig();
  return connect({ url, authToken });
}
```

Query from `src/services/`, never from a route. Schema changes are SQL files you
apply with the Turso CLI (or Drizzle migrations if you took Phase 6c) — a
service does not migrate its own database on boot.

**Tests use the real database.** The Workers pool loads `.dev.vars`, so a
service test hits the Turso database those credentials point at. Point them at a
dedicated dev/test database, not production, and have each test create and clean
up its own rows.

---

## Phase 6 — Optional integrations (only what Phase 0 selected)

Skip any the user declined. Add a README line under the relevant folder for each.

### 6a. Auth (better-auth)

```bash
# @libsql/kysely-libsql is the Kysely dialect the sample below imports —
# better-auth pulls in kysely itself, but not the libSQL dialect for it.
bun add better-auth @libsql/kysely-libsql
```

better-auth is the house auth library, and this service owns the **server** half
— the console app only holds the client. It needs `nodejs_compat`, which
`wrangler.jsonc` already sets.

Build the auth instance **per request** from the bindings (a Worker isolate
serves many requests; a module-level instance would capture one request's env),
mount its handler, and let it own the session tables in Turso:

```ts
// src/services/auth-service.ts
import { betterAuth } from 'better-auth';
import { LibsqlDialect } from '@libsql/kysely-libsql';
import { tursoConfig } from '@/constants/env';

/** Builds the auth instance for this request. */
export function createAuth() {
  const { url, authToken } = tursoConfig();
  return betterAuth({
    database: {
      dialect: new LibsqlDialect({ url, authToken }),
      type: 'sqlite',
    },
    emailAndPassword: { enabled: true },
  });
}
```

```ts
// in src/app.ts
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth().handler(c.req.raw));
```

Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to `.dev.vars` (and
`wrangler secret put` per environment), and generate the auth tables with
better-auth's CLI before the first request. Check better-auth's current docs for
the exact option names — it moves faster than this kit.

### 6b. Structured logging

**Not pino.** Pino targets Node streams; on Workers the platform already
captures structured logs. Write one small helper and let Workers Logs index it:

```ts
// src/utilities/logger.ts
/** Emits one JSON line per event — Workers Logs indexes the fields. */
export function logInfo(message: string, fields: Record<string, unknown> = {}): void {
  console.warn(JSON.stringify({ level: 'info', message, ...fields }));
}
```

(`console.log` is blocked by the gate; `console.warn`/`console.error` are the
sanctioned writers and both reach Workers Logs.) Turn on request logging with
Hono's `logger()` middleware, and keep `observability.enabled` on in
`wrangler.jsonc` so the logs are actually retained.

### 6c. Drizzle ORM

Only when the schema and query surface justify typed models and migrations —
the raw client is enough for a handful of statements.

```bash
bun add drizzle-orm @libsql/client
bun add -d drizzle-kit
```

Use the **web** entry point (`@libsql/client/web`), which is fetch-only and the
one that runs on workerd; the default entry is Node-native and will not. Put the
schema in `src/db/schema.ts`, the client in `src/db/client.ts`, migrations in
`drizzle/`, and set `dialect: 'turso'` in `drizzle.config.ts`.

---

## Phase 7 — CI and the review guard rails

```bash
mkdir -p .github/workflows
```

1. Copy `templates/.github/workflows/ci.yml` → `.github/workflows/ci.yml`. It
   verifies the committed Worker types are current, then runs type-check + lint +
   format-check + structure-check + knip + jscpd + test, and finishes with a dry-run deploy that
   bundles the Worker without publishing. Keep its `bun-version` in sync with the
   Bun you develop against. Commit the lockfile (`bun.lock`) — CI installs with
   `--frozen-lockfile`.
2. Copy `templates/.github/workflows/code-review.yml` →
   `.github/workflows/code-review.yml`. It reviews every PR against this repo's
   own convention files, read from the **base** ref. Needs an
   `OPENROUTER_API_KEY` repository secret.

See [`../../CORE.md`](../../CORE.md) → "Quality gates & guardrails" for how the
four layers fit together.

---

## Phase 8 — Top-level README

Generate the project `README.md` from `templates/README.md`: fill in the app name
+ description; keep the layout table, config table, and scripts. Cross-link
`CLAUDE.md`.

---

## Phase 9 — Verify

Run the full gate and fix anything red:

```bash
bun run check                      # type-check + lint + fmt + structure + knip + jscpd + test
bun run dev &                      # wrangler dev — the real runtime, on :8787
curl localhost:8787/health         # → {"status":"ok"}
bunx wrangler deploy --dry-run     # bundles + validates config, publishes nothing
```

Report the results honestly. Do not mark setup complete with any gate step
failing.

---

## Phase 10 — Human-only checklist (print this for the user)

End by printing what only a human can do. Tailor it to the chosen options; the
common items:

- [ ] **Cloudflare account**: run `wrangler login`, confirm the account id, and
      run the first `bun run deploy`.
- [ ] **Turso database**: create it (`turso db create <name>`), get the URL and
      an auth token, put them in `.dev.vars` locally, and push them per
      environment with `wrangler secret put TURSO_DATABASE_URL` /
      `wrangler secret put TURSO_AUTH_TOKEN` (repeat with `--env staging`).
- [ ] **Create a separate dev/test database** and point `.dev.vars` at it —
      tests write real rows, and they must not be production rows.
- [ ] **Apply the initial schema** to each environment's database.
- [ ] **Auth secrets** (if wired): `wrangler secret put BETTER_AUTH_SECRET`, and
      register any OAuth apps with their providers.
- [ ] **Route / custom domain**: attach the Worker to its hostname and confirm
      TLS.
- [ ] **GitHub repo**: create it, push, and add the `OPENROUTER_API_KEY` secret.
- [ ] **Branch protection**: require the **CI** check and a passing **Code
      Review** on PRs to `main`.

> Once these are done, the service is ready to deploy.
