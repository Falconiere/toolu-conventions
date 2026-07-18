# SETUP — New Web App (Next.js)

**You are an AI coding agent. Your job is to scaffold a new Next.js web app by
following this guide top to bottom.** Work through the phases in order. Phase 0
gathers everything you need; after that, prefer acting over asking. When a step
references a template, read it from this kit's `templates/` directory and adapt
it (replace `{{PLACEHOLDERS}}`, fill the folder's specifics) — do not invent
config from memory.

**Target baseline (non-negotiable):** Next.js latest (App Router) · TypeScript
(strict) · bun · Vitest + `@testing-library/react` · oxlint + oxfmt · Lefthook ·
the folder structure and conventions in [`STRUCTURE.md`](./STRUCTURE.md) · the
lean library set in [`LIBRARIES.md`](./LIBRARIES.md). The app is
**backend-agnostic** by default — only wire API/auth/DB if Phase 0 says to.

Read [`../../CORE.md`](../../CORE.md), then [`STRUCTURE.md`](./STRUCTURE.md) and
[`LIBRARIES.md`](./LIBRARIES.md) before you start. Every CORE rule binds this
project; STRUCTURE and LIBRARIES define the layout and the allowed dependencies.

**A note on vibe:** keep it light and a little silly with the user as you go — a
fun aside, a cheeky sign-off, the occasional joke. Never at the expense of the
work: configs, code, and honest status reports stay rock-solid, and if something
fails you say so straight. This same house style is baked into the app's
`CLAUDE.md` (`templates/CLAUDE.md.template`). Welcome to the bit. 🎬

---

## Phase 0 — Prerequisites & intake

### 0.1 Check the toolchain

Run these; if any is missing, install it (or tell the user how) and stop until
resolved.

```bash
node --version   # >= 20
bun --version    # package manager for this project
git --version
```

### 0.2 Intake questions (ask the user, then proceed)

Collect all of these up front; use the noted defaults.

**Identity**
- App **display name** (e.g. "Acme Console") and a kebab-case **project name**
  (e.g. `acme-console`) used for the directory and `package.json` name.

**Environments**
- development and production always exist. **Is a STAGING environment needed?**
  (default: no — it's just another deploy target with `NEXT_PUBLIC_ENV=staging`;
  add later if unsure.)

**Optional integrations** (each defaults to *no* — keep the baseline lean):
- **API layer?** If yes: base URL(s) per env; wires `@tanstack/react-query` +
  `axios` and the `src/api/clients` + `src/api/queries` pattern (Phase 6a).
- **Auth?** If yes: Auth.js (`next-auth` v5) — provider(s) and whether routes
  are gated (Phase 6b).
- **Database client?** If yes: which one (default `drizzle-orm`; `bun:sql` /
  `postgres` for a thin layer) and the target engine (Phase 6c). Server-only.

**Design context** (optional — feeds the theme tokens + `CLAUDE.md`):
- Who are the **target users** and in what context? What **jobs** are they doing?
- **Brand personality / tone**, any **palette** direction, reference sites.
- Does the design call for **Tailwind CSS**? (default: no — CSS Modules +
  theme tokens. Only add Tailwind if the design context asks for it.)

Echo back a short summary of the chosen options before scaffolding.

---

## Phase 1 — Scaffold the Next.js app

From an empty working directory (create `<project-name>/` and `cd` in, or run in
place). Scaffold with the App Router, `src/` directory, the `@/*` import alias,
bun as the package manager, and **oxlint instead of ESLint** (`--no-eslint`):

```bash
bunx create-next-app@latest . \
  --ts --app --src-dir --no-tailwind --no-eslint \
  --import-alias "@/*" --use-bun --yes
```

- **Tailwind:** the default is `--no-tailwind`. **Only if** the Phase 0 design
  context asked for it, swap `--no-tailwind` → `--tailwind`.
- If `create-next-app` prints any interactive prompt despite the flags, choose:
  TypeScript **yes**, App Router **yes**, `src/` **yes**, ESLint **no**,
  Turbopack **yes**, import alias **`@/*`**.

Then confirm a clean install and that the app boots once:

```bash
bun install
bun run dev   # visit http://localhost:3000, then Ctrl-C
```

---

## Phase 2 — Baseline dependencies & tooling

Add the test + lint/format toolchain (Next already installed `react`,
`react-dom`, `next`, `typescript`, and the `@types/*`):

```bash
# Testing
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Lint / format + git hooks
bun add -d oxlint oxfmt oxlint-tsgolint lefthook
```

Copy and adapt these templates into the project root (overwriting what
`create-next-app` generated where they overlap):

- `templates/tsconfig.json` → `tsconfig.json` (strict + `@/*` path alias)
- `templates/next.config.ts` → `next.config.ts` (delete a generated
  `next.config.mjs`/`next.config.js` if present — one config file only)
- `templates/vitest.config.ts` → `vitest.config.ts`
- `templates/vitest.setup.ts` → `vitest.setup.ts`
- `templates/.oxlintrc.json` → `.oxlintrc.json`
- `templates/.oxfmtrc.json` → `.oxfmtrc.json` (sets `singleQuote: true` — oxfmt
  defaults to double quotes, so without this the single-quoted templates fail
  `oxfmt --check` in the gate)
- `templates/lefthook.yml` → `lefthook.yml` **before** running the installer —
  use the `.yml` name (lefthook 2.x's `install` writes a stub `lefthook.yml`
  that silently shadows a `lefthook.yaml`, so hooks never fire). Then run
  `bunx lefthook install`; if the installer already dropped a stub `lefthook.yml`,
  overwrite it with the template.
- `templates/scripts/check-structure.sh` → `scripts/check-structure.sh`
  (`mkdir -p scripts` first). This is the folder-tree half of the gate — it
  enforces the STRUCTURE rules oxlint can't see (allowed `src/` dirs, per-folder
  READMEs, no barrel files, no shadowing `lefthook.yaml`).

Set the `package.json` scripts (merge with what `create-next-app` generated;
**remove** any `lint` script that calls `next lint`/ESLint):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:structure": "bash scripts/check-structure.sh",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the single quality gate =
`tsc --noEmit` + `oxlint --deny-warnings` + `oxfmt --check` +
`bash scripts/check-structure.sh` + `vitest run` (the CORE gate order).

Normalize the generated files to house formatting once, then confirm the bare
project is green so far:

```bash
bun run fmt          # oxfmt writes; normalizes create-next-app output
bun run type-check
bun run lint
```

---

## Phase 3 — Create the folder structure

Build the tree from [`STRUCTURE.md`](./STRUCTURE.md) (`create-next-app --src-dir`
already made `src/app`):

```bash
mkdir -p src/ui/theme src/features src/api/clients src/api/queries \
         src/utilities src/providers src/constants src/types
```

Then:

1. Copy `templates/theme/{colors,spacing,typography}.ts` → `src/ui/theme/`.
2. Copy `templates/env.ts` → `src/constants/env.ts`. It validates `NEXT_PUBLIC_*`
   vars by hand (no schema library). **Keep the static member-access pattern** —
   Next.js only inlines `process.env.NEXT_PUBLIC_X` at direct access sites, so a
   loop/dynamic access collapses every var to `undefined` in the production
   bundle. Add a new public var by reading it via its full static path and
   validating it inline.
3. Drop a `README.md` into each of `src/ui`, `src/features`, `src/api`,
   `src/utilities`, and `src/providers`, generated from
   `templates/folder-README.md` (fill in the folder's purpose + a short "what's
   inside" list — seed it now, keep it updated as you add files).
4. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` and fill in the app name +
   specifics. This is the rulebook + repo map agents read first.

**Conventions reminder while you build:** no barrel files, kebab-case filenames
named after their export, co-located `__tests__/`, no `any`, no `console.log`,
default exports only under `src/app/`.

---

## Phase 4 — Environments (development / production / optional STAGING)

1. Copy `templates/.env.example` → `.env.example`; create a local `.env.local`
   and fill it in. Ensure `.gitignore` ignores `.env*` **except** `.env.example`
   (Next's default `.gitignore` already ignores `.env*` — add a
   `!.env.example` negation).
2. Public vars are prefixed `NEXT_PUBLIC_` and validated in
   `src/constants/env.ts`. Server-only secrets have no prefix, are read directly
   in server code, and never reach the client.
3. If **STAGING** was requested, staging is a deploy target that sets
   `NEXT_PUBLIC_ENV=staging` (and its own `NEXT_PUBLIC_API_URL`); `APP_ENV` in
   `env.ts` already recognizes it. If it was **not** requested, nothing to do —
   the `'staging'` branch stays inert.

---

## Phase 5 — Wire the root layout + providers

App-wide providers (React Query, theme, auth) must live in a **Client
Component**, mounted from the Server Component root layout. Create
`src/providers/app-providers.tsx`:

```tsx
'use client';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  // Wrap with QueryClientProvider / ThemeProvider / SessionProvider here as
  // integrations are added (Phase 6). Keep it a single provider component.
  return <>{children}</>;
}
```

Then make `src/app/layout.tsx` the Server Component root that owns `<html>` /
`<body>` and mounts the providers:

```tsx
import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

export const metadata = { title: '{{APP_NAME}}' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

Replace the `create-next-app` demo `src/app/page.tsx` with a thin route that
re-exports a feature screen. Create `src/features/home/screens/home-screen.tsx`
(a Server Component is fine — no `'use client'` unless it needs interactivity):

```tsx
// src/features/home/screens/home-screen.tsx
export function HomeScreen() {
  return <main>Hello from {`{{APP_NAME}}`}</main>;
}
```

```tsx
// src/app/page.tsx
import { HomeScreen } from '@/features/home/screens/home-screen';

export default HomeScreen;
```

Delete any leftover demo assets/styles from the template you won't keep.

---

## Phase 6 — Optional integrations (only what Phase 0 selected)

Skip any the user declined. Add a README line under the relevant folder for each.

**6a. API layer** — `bun add @tanstack/react-query axios`. Create
`src/api/http-client.ts` (an axios instance + interceptors reading
`BASE_API_URL`/`REQUEST_TIMEOUT_MS` from `@/constants/env`), `src/api/api-error.ts`
(a typed error class), and a sample `clients/` + `queries/` pair per
[`STRUCTURE.md`](./STRUCTURE.md). Wire a `QueryClientProvider` (with a single
`QueryClient`) into `AppProviders`. Prefer fetching in Server Components where you
can; use React Query for interactive client-side data.

**6b. Auth** — Auth.js: `bun add next-auth@beta`. Add the auth config + route
handler at `src/app/api/auth/[...nextauth]/route.ts`, a `SessionProvider` inside
`AppProviders`, and (if routes are gated) `middleware.ts` at the project root.
Put `AUTH_SECRET` and provider secrets in `.env.local` (server-only, unprefixed).

**6c. Database client** — server-only. `drizzle-orm`:
`bun add drizzle-orm` + the driver (e.g. `postgres`), `bun add -d drizzle-kit`.
Create `src/api/db/client.ts` (the connection, reading `DATABASE_URL` from a
server-only env var) and schema files under `src/api/db/`. **Never import the DB
client into a Client Component** — keep it in Server Components, route handlers,
and server actions.

For any product integration (Sentry, analytics, Stripe, email), follow
[`LIBRARIES.md`](./LIBRARIES.md) and add it as its own provider/module — never as
a default.

---

## Phase 7 — Design pass

If Phase 0 supplied design context, apply it now:

1. Fill real values into `src/ui/theme/{colors,spacing,typography}.ts` from the
   palette / tone direction (replace the placeholders). Avoid generic
   cyan-on-dark and glassmorphism-everywhere; build real visual hierarchy.
2. Record the design direction (audience, jobs, tone, palette) in the
   `## Design notes` section of `CLAUDE.md` so future agents inherit it.
3. If the design called for **Tailwind** and you scaffolded with it, keep the
   token values as the single source of truth (map them into the Tailwind theme
   rather than duplicating hex literals).
4. Build the `src/ui/*` primitives the screens need, composed from the tokens.

If no design context was given, leave the placeholder tokens and note in
`CLAUDE.md` that the design pass is pending.

---

## Phase 8 — CI

Copy `templates/.github/workflows/ci.yml` → `.github/workflows/ci.yml`. It runs
type-check + lint + fmt:check + test (the same checks as `bun run check`) on PRs
and pushes to `main`. Keep its `bun-version` current.

```bash
mkdir -p .github/workflows
# copy templates/.github/workflows/ci.yml into place
```

---

## Phase 9 — Top-level README

Generate the project `README.md` from `templates/README.md`: description, the
project layout table, environments, scripts, and CI. Fill the `{{STAGING_ROW}}`
(a staging row if requested, else remove the line). Cross-link `CLAUDE.md`.

---

## Phase 10 — Verify (run the gate)

Run the full gate and fix anything red before calling setup done:

```bash
bun run check      # tsc --noEmit + oxlint --deny-warnings + oxfmt --check + check-structure + vitest run
bun run build      # production build succeeds
```

`bun run check` must exit 0. Report the results honestly — do not mark setup
complete with any gate failing. (A fresh scaffold has no tests yet; `vitest run`
passes on an empty suite via `passWithNoTests`. The first feature brings its own
`__tests__/` with real-data tests.)

---

## Phase 11 — Human-only checklist (print this for the user)

End by printing the checklist of what only a human can do. Tailor it to the
chosen options; the common items:

- [ ] **Hosting**: create the project on the host (e.g. Vercel), connect the git
      repo, and confirm the production branch is `main`.
- [ ] **Environment secrets**: add every `NEXT_PUBLIC_*` and server-only var
      (`AUTH_SECRET`, `DATABASE_URL`, API keys) to the host's env settings, per
      environment (development / staging / production). Never commit `.env.local`.
- [ ] **Domain**: point the custom domain at the host and provision TLS.
- [ ] **Database** (if wired): provision the database, set `DATABASE_URL`, and
      run the initial migration.
- [ ] **Auth** (if wired): register the OAuth app(s) with each provider and add
      the client id/secret + `AUTH_SECRET` to the host env.
- [ ] **GitHub repo**: create it, push, and require the **CI** check
      (`.github/workflows/ci.yml`) on PRs to `main` (branch protection).

> Once these are done, the app is ready to deploy.
