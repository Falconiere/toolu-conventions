# SETUP — New backend-ts Service

**You are an AI coding agent scaffolding a Bun + Hono HTTP service.** Follow this
guide top to bottom in an empty project directory. Work the phases in order:
Phase 0 gathers inputs, after that prefer acting over asking. When a step
references a template, read it from this kit's `templates/` directory and adapt it
(replace `{{PLACEHOLDERS}}`) — do not invent config from memory.

**Target baseline (non-negotiable):** Bun (runtime + package manager + test
runner) · Hono · TypeScript (strict) · `bun test` · oxlint + oxfmt · Lefthook ·
the layout and conventions in [`STRUCTURE.md`](./STRUCTURE.md) · the lean library
set in [`LIBRARIES.md`](./LIBRARIES.md). The service is **integration-agnostic** by
default — only wire a DB client, auth, or logging if Phase 0 says to.

Read [`../../CORE.md`](../../CORE.md), [`STRUCTURE.md`](./STRUCTURE.md), and
[`LIBRARIES.md`](./LIBRARIES.md) before you start.

---

## Phase 0 — Prerequisites & intake

### 0.1 Check the toolchain

```bash
bun --version    # package manager, runtime, and test runner for this project
git --version    # version control
```

If `bun` is missing, install it (`curl -fsSL https://bun.sh/install | bash`) and
re-check before continuing.

### 0.2 Intake (the root `SETUP.md` normally passes these in)

Confirm these answers before scaffolding; ask only for what's missing:

- **Project name** — kebab-case (directory + package name).
- **Staging environment?** — DEV + PROD always exist; add STAGING? (default: no.)
- **Optional integrations** (each defaults to *no* — keep the baseline lean):
  - **DB client?** If yes, **which** — Postgres via Bun's built-in `bun:sql`
    (zero-dep) or `drizzle-orm` (typed schema + migrations)? (Phase 5a.)
  - **Bearer-token auth middleware?** yes/no (Phase 5b.)
  - **Structured logging (`pino`)?** yes/no (Phase 5c.)

Echo back the chosen options before scaffolding.

---

## Phase 1 — Scaffold the project

From the new project directory (empty):

```bash
bun init -y
```

This writes `package.json`, a root `index.ts`, `tsconfig.json`, `.gitignore`, and
adds `@types/bun`. Then install Hono and remove the generated root entry (this kit
puts the entry at `src/index.ts`):

```bash
bun add hono
rm -f index.ts        # the kit ships src/index.ts instead
```

---

## Phase 2 — Dev tooling & scripts

Install the lint/format/test tooling and the TypeScript compiler (for
`tsc --noEmit`):

```bash
bun add -d typescript oxlint oxfmt oxlint-tsgolint lefthook @types/bun
```

Copy and adapt these templates into the project root (overwrite what `bun init`
generated):

- `templates/tsconfig.json` → `tsconfig.json` (strict + the `@/*` path alias)
- `templates/bunfig.toml` → `bunfig.toml` (`bun test` config)
- `templates/.oxlintrc.json` → `.oxlintrc.json`
- `templates/.oxfmtrc.json` → `.oxfmtrc.json` (oxfmt uses single quotes — the
  house style; without this config oxfmt defaults to double quotes and the gate
  fails)
- `templates/lefthook.yml` → `lefthook.yml` (must be `.yml`, not `.yaml` — see the
  install note below)
- `templates/scripts/check-structure.sh` → `scripts/check-structure.sh`
  (`mkdir -p scripts` first; `chmod +x` it) — the structure gate that machine-checks
  the folder layout the linter can't (allowed `src/` dirs, per-folder READMEs, no
  barrel files)

Set the `package.json` `scripts` block to exactly this (merge over what `bun init`
generated):

```json
{
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "type-check": "tsc --noEmit",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "check:structure": "bash scripts/check-structure.sh",
    "test": "bun test",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the one gate command — type-check + lint + format-check +
structure-check + test, in that order. Now install the pre-commit hooks — **the
config must already be in place** (copied in the step above) before you run this:

```bash
bunx lefthook install
```

> **Config file must be `lefthook.yml`, not `lefthook.yaml`.** Lefthook 2.x's
> `install` writes a `lefthook.yml` stub, and when both exist the `.yml` shadows
> the `.yaml` — so a `lefthook.yaml` config silently stops taking effect and hooks
> don't run. Ship the config as `lefthook.yml`; if a stub `lefthook.yml` already
> exists from a stray earlier `install`, overwrite it with the template.

---

## Phase 3 — Folder structure & source skeleton

Build the tree from [`STRUCTURE.md`](./STRUCTURE.md):

```bash
mkdir -p src/routes/__tests__ src/services/__tests__ src/utilities src/constants src/types
```

Then:

1. Copy `templates/env.ts` → `src/constants/env.ts` (hand-validated env — no schema
   library; keep it that way and add vars inline).
2. Copy `templates/src/app.ts` → `src/app.ts` (the Hono app + `/health` route).
3. Copy `templates/src/index.ts` → `src/index.ts` (`Bun.serve` entry using
   `PORT` from env).
4. Copy `templates/.env.example` → `.env.example`; create a local `.env` (and
   `.env.staging` if STAGING was requested). Add `.env*` (except `.env.example`)
   to `.gitignore`.
5. Drop a `README.md` into each of `src/routes`, `src/services`, `src/utilities`,
   `src/constants`, and `src/types`, generated from `templates/folder-README.md`
   (fill in the folder's purpose + a short "what's inside" list — seed it now,
   keep it updated as you add files).
6. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` and fill in the app name +
   one-line description. This is the rulebook + repo map agents read first.

Add a first real test so `bun test` has something to run — a route test that
exercises the app end-to-end (real request, real response; no mocks):

```ts
// src/routes/__tests__/health-route.test.ts
import { describe, expect, test } from 'bun:test';
import { app } from '@/app';

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
```

**Conventions reminder while you build:** no barrel files, kebab-case filenames
named after their export, named exports only, thin routes + services for logic,
co-located `__tests__/`, no `any`, no `console.log`.

---

## Phase 4 — Environments (DEV / PROD / optional STAGING)

`src/constants/env.ts` reads `APP_ENV` (`development` | `staging` | `production`)
and `PORT`, validating both by hand. Bun loads `.env` natively.

- If STAGING was **not** requested, remove `'staging'` from the `AppEnv` union in
  `env.ts` and drop the staging line from `.env.example`.
- Set real values in each environment's `.env`. Never commit `.env` — only
  `.env.example` is tracked.

---

## Phase 5 — Optional integrations (only what Phase 0 selected)

Skip any the user declined. Add a README line under the relevant folder for each.

### 5a. DB client

**Postgres via `bun:sql` (zero-dep):** create `src/db/client.ts` exporting a
configured `sql` instance from `bun:sql`, reading `DATABASE_URL` (add + validate
it in `env.ts`). Query inside `services/`, never in routes.

> Adding `src/db/` introduces a new top-level dir, so add `db` to `allowed_dirs`
> in `scripts/check-structure.sh` (and give it a `README.md`) or the structure
> gate rejects it.

```ts
// src/db/client.ts
import { SQL } from 'bun:sql';
import { DATABASE_URL } from '@/constants/env';

export const db = new SQL(DATABASE_URL);
```

**Drizzle:** `bun add drizzle-orm` (+ the driver for your DB). Put the schema in
`src/db/schema.ts`, the client in `src/db/client.ts`, and migrations in
`drizzle/`. Reach for Drizzle when the schema + query surface justify typed models
and migrations; otherwise `bun:sql` is enough. See LIBRARIES.md.

### 5b. Bearer-token auth middleware

Create `src/middleware/auth.ts` — a Hono middleware that checks the `Authorization`
header against `AUTH_TOKEN` (add + validate it in `env.ts`):

```ts
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { AUTH_TOKEN } from '@/constants/env';

/** Rejects any request whose bearer token doesn't match AUTH_TOKEN. */
export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (header !== `Bearer ${AUTH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});
```

Mount it in `src/app.ts` on the protected routes: `app.use('/api/*', requireAuth)`.
This is a skeleton — swap the static-token check for JWT/session verification when
the real auth scheme is chosen.

> Adding `src/middleware/` introduces a new top-level dir, so add `middleware` to
> `allowed_dirs` in `scripts/check-structure.sh` (and give it a `README.md`) or the
> structure gate rejects it.

### 5c. Structured logging (`pino`)

`bun add pino`. Create `src/utilities/logger.ts` exporting one configured instance
(level from `LOG_LEVEL`, add + validate it in `env.ts`); log through it in
services. Add Hono's request logger for access lines:
`import { logger } from 'hono/logger'` then `app.use(logger())` in `src/app.ts`.
Replace the `process.stdout.write` startup banner in `index.ts` with a logger call.

---

## Phase 6 — CI

```bash
mkdir -p .github/workflows
```

Copy `templates/.github/workflows/ci.yml` → `.github/workflows/ci.yml`. It runs
the same checks as `bun run check` (type-check + lint + format-check +
structure-check + test) on every PR and push to `main`. Keep its `bun-version` in sync with the Bun you
develop against locally. Commit the lockfile (`bun.lock`) — CI installs with
`--frozen-lockfile`.

---

## Phase 7 — Top-level README

Generate the project `README.md` from `templates/README.md`: fill in the app name
+ description; keep the layout table, env table, and scripts. Cross-link
`CLAUDE.md`.

---

## Phase 8 — Verify

Run the full gate and fix anything red:

```bash
bun run check     # type-check + lint + fmt:check + test — all must pass
bun run dev &     # boots the server; then:
curl localhost:3000/health   # → {"status":"ok"}
```

Report the results honestly. Do not mark setup complete with any gate step
failing.

---

## Phase 9 — Human-only checklist (print this for the user)

End by printing what only a human can do. Tailor it to the chosen options; the
common items:

- [ ] Choose and provision the **deploy target** (Fly.io / Railway / a container
      host) and wire a deploy step or Dockerfile.
- [ ] Create the **secrets** each environment needs (`AUTH_TOKEN`, `DATABASE_URL`,
      any API keys) in the host's secret store — never in `.env` in git.
- [ ] **Provision the database** (if the DB integration was selected): create the
      instance, run migrations, and set `DATABASE_URL` per environment.
- [ ] Create the GitHub repo + branch protection; require the **CI** check
      (`.github/workflows/ci.yml`) on PRs to `main`.
- [ ] Set `APP_ENV` + `PORT` (and staging vars, if enabled) per environment.

> Once these are done, the service is ready to deploy.
