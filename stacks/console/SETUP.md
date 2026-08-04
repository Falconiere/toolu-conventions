# SETUP — New Console App (React + Vite + TanStack Router)

**You are an AI coding agent. Your job is to scaffold a new console app by
following this guide top to bottom.** Work through the phases in order. Phase 0
gathers everything you need; after that, prefer acting over asking. When a step
references a template, read it from this kit's `templates/` directory and adapt
it (replace `{{PLACEHOLDERS}}`, fill the folder's specifics) — do not invent
config from memory.

**Target baseline (non-negotiable):** React + Vite · TanStack Router (file-based,
`src/app/`) · TypeScript (strict) · bun · Vitest + `@testing-library/react` ·
oxlint + oxfmt · Lefthook · Cloudflare Workers as the deploy target · the folder
structure and conventions in [`STRUCTURE.md`](./STRUCTURE.md) · the lean library
set in [`LIBRARIES.md`](./LIBRARIES.md). The app is **backend-agnostic** by
default — only wire the API layer, auth, or a Worker/DB if Phase 0 says to.

Read [`../../CORE.md`](../../CORE.md), then [`STRUCTURE.md`](./STRUCTURE.md),
[`LIBRARIES.md`](./LIBRARIES.md), and [`../../DESIGN.md`](../../DESIGN.md) before
you start. Every CORE rule binds this project; STRUCTURE and LIBRARIES define the
layout and the allowed dependencies; DESIGN.md is the language the theme tokens
copied in Phase 3 already implement.

**A note on vibe:** keep it light and a little silly with the user as you go — a
fun aside, a cheeky sign-off, the occasional joke. Never at the expense of the
work: configs, code, and honest status reports stay rock-solid, and if something
fails you say so straight. This same house style is baked into the app's
`CLAUDE.md` (`templates/CLAUDE.md.template`). Welcome to the bit. 🎬

---


Copy the guard-rail module and its configuration:

- `templates/scripts/guardrails/` → `scripts/guardrails/` (the whole directory,
  **verbatim** — it is the kit's copy and is never hand-edited; change
  `guardrails.config.json` instead)
- `templates/guardrails.config.json` → `guardrails.config.json` (this stack's
  ceilings, allowed directories and banned dependencies)
- `templates/.claude/settings.json` → `.claude/settings.json` (**committed** —
  the `PostToolUse` + `Stop` hooks that run the guard rails while an agent is
  still writing the code; CORE guard-rail layer 2)

`scripts/guardrails/run.sh` needs `jq` on PATH and exits 3 without it, so a
missing dependency can never look like a clean run.

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
  (e.g. `acme-console`) used for the directory, the `package.json` name, and the
  Cloudflare Worker name.

**Environments**
- development and production always exist. **Is a STAGING environment needed?**
  (default: no — it's another Worker environment with `VITE_ENV=staging`; add
  later if unsure.)

**Optional integrations** (each defaults to *no* — keep the baseline lean):
- **API layer?** If yes: base URL(s) per env; wires the oRPC client + its
  TanStack Query bindings (`src/api/orpc.ts`) and the `http-client` + `clients`
  pattern for non-oRPC calls (Phase 6a). The HTTP client itself ships with the
  kit either way.
- **Auth?** If yes: **better-auth**. The console gets the client half; the server
  half lives in the API service (Phase 6b).
- **Same-project Worker API?** If yes: `@cloudflare/vite-plugin` + `src/worker.ts`
  + Turso (Phase 6c). Default **no** — the console talks to a separate
  `backend-ts` service.

**Design context** (optional — feeds the theme tokens + `CLAUDE.md`):
- Who are the **target users** and in what context? What **jobs** are they doing?
- **Brand personality / tone**, any **palette** direction, reference sites.
- Does the design call for **Tailwind CSS**? (default: no — CSS Modules +
  theme tokens. Only add Tailwind if the design context asks for it.)

Echo back a short summary of the chosen options before scaffolding.

---

## Phase 1 — Scaffold the Vite app

From an empty working directory (create `<project-name>/` and `cd` in, or run in
place):

```bash
bun create vite . --template react-ts
```

Then strip the demo and the parts this kit replaces — `create-vite` ships an
ESLint config we don't use and a split tsconfig this kit collapses into one:

```bash
rm -rf src/App.tsx src/App.css src/index.css src/assets public/vite.svg
rm -f eslint.config.js tsconfig.app.json tsconfig.node.json
```

`src/main.tsx` and `index.html` stay for now — Phase 5 replaces both with the
kit's versions.

---

## Phase 2 — Baseline dependencies & tooling

```bash
# Router (the plugin is what generates the route tree)
bun add @tanstack/react-router
bun add -d @tanstack/router-plugin

# Data + validation + forms: server state, typed API client, forms, one validator
bun add @tanstack/react-query @tanstack/react-form @orpc/client @orpc/tanstack-query zod

# Self-hosted fonts named by the design language
bun add @fontsource-variable/archivo @fontsource-variable/jetbrains-mono

# Testing
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Lint / format / gate + git hooks + deploy CLI
bun add -d oxlint oxfmt oxlint-tsgolint knip jscpd lefthook @ast-grep/cli wrangler
```

Copy and adapt these templates into the project root, **overwriting** what
`create-vite` generated where they overlap:

- `templates/tsconfig.json` → `tsconfig.json` (strict, `@/*` alias, one file —
  the generated `tsconfig.app.json`/`tsconfig.node.json` were deleted in Phase 1)
- `templates/vite.config.ts` → `vite.config.ts` (build **and** Vitest config; see
  the "One Vite config" rule in `STRUCTURE.md` — never add a `vitest.config.ts`)
- `templates/vitest.setup.ts` → `vitest.setup.ts`
- `templates/.oxlintrc.json` → `.oxlintrc.json`
- `templates/.oxfmtrc.json` → `.oxfmtrc.json` (sets `singleQuote: true` — oxfmt
  defaults to double quotes, so without this the single-quoted templates fail
  `oxfmt --check` in the gate)
- `templates/knip.json` → `knip.json` (unused files/exports/dependencies)
- `templates/.jscpd.json` → `.jscpd.json` (copy-paste detection). **Keep both
  `"threshold": 0` and `"exitCode": 1`.** The threshold is what fails the gate;
  the exit code only matters if someone later raises the threshold, where jscpd
  stops throwing and would otherwise report clones and exit 0.
- `templates/.gitattributes` → `.gitattributes` (marks the generated route tree
  so it collapses in diffs and is skipped by the AI review)
- `templates/lefthook.yml` → `lefthook.yml` **before** running the installer —
  use the `.yml` name (lefthook 2.x's `install` writes a stub `lefthook.yml`
  that silently shadows a `lefthook.yaml`, so hooks never fire). Then run
  `bunx lefthook install`; if the installer already dropped a stub `lefthook.yml`,
  overwrite it with the template.
- `templates/scripts/guardrails/` → `scripts/guardrails/` — the WHOLE directory — `run.sh` sources `lib/` and `checks/` from beside itself, so copying it alone fails at runtime
  (`mkdir -p scripts` first). This is the folder-tree half of the gate — it
  enforces the STRUCTURE rules oxlint can't see (allowed `src/` dirs, per-folder
  READMEs, no barrel files, no second Vitest config, no banned dependency, no
  shadowing `lefthook.yaml`).

Set the `package.json` scripts (merge with what `create-vite` generated;
**remove** the generated `lint` script that calls ESLint):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "bun run build && wrangler deploy",
    "type-check": "tsc --noEmit",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:structure": "bash scripts/guardrails/run.sh",
    "check:unused": "knip",
    "check:dupes": "jscpd",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the single quality gate =
`tsc --noEmit` + `oxlint --deny-warnings` + `oxfmt --check` +
`bash scripts/guardrails/run.sh` + `knip` + `jscpd` + `vitest run` (the CORE
gate order).

---

## Phase 3 — Create the folder structure

Build the tree from [`STRUCTURE.md`](./STRUCTURE.md):

```bash
mkdir -p src/app src/ui/theme src/features/home/screens src/api/clients \
         src/api/queries src/utilities src/providers src/constants src/types
```

Then:

1. Copy `templates/theme/{colors,spacing,typography,motion,icons}.ts` →
   `src/ui/theme/`. They ship pre-filled with the house design language
   ([`../../DESIGN.md`](../../DESIGN.md)) — real values, not placeholders. Phase 7
   only changes them if the intake asked for a different brand.
2. Copy `templates/utilities/http.ts` → `src/utilities/http.ts`. This is how the
   app calls **anything that is not our own API** (there is no axios in this
   kit); our API goes through oRPC in Phase 6a. Read its header comment before
   writing a request anywhere.
3. Copy [`../../DESIGN.md`](../../DESIGN.md) → `docs/design-language.md`
   (`mkdir -p docs` first) **verbatim**. The kit is not on disk once this project
   is scaffolded, so without this copy the design rules — which the token files
   only carry values for — never reach the agents who build here. `CLAUDE.md`
   points at it for UI work; keep it out of the always-loaded context.
4. Copy `templates/env.ts` → `src/constants/env.ts`. It validates `VITE_*` vars
   with a Zod schema. **Keep the static member-access pattern** — Vite
   only substitutes `import.meta.env.VITE_X` at direct access sites, so a loop or
   a dynamic index collapses every var to `undefined` in the production bundle.
5. Drop a `README.md` into each of `src/ui`, `src/features`, `src/api`,
   `src/utilities`, `src/providers`, `src/constants`, and `src/types`, generated
   from `templates/folder-README.md` (fill in the folder's purpose + a short
   "what's inside" list — seed it now, keep it updated as you add files). Every
   top-level `src/` directory except `src/app` carries one —
   `scripts/guardrails/run.sh` fails the gate without it.
6. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` and fill in the app name +
   specifics. This is the rulebook + repo map agents read first.

**Conventions reminder while you build:** no barrel files, kebab-case filenames
named after their export, named exports everywhere (routes included), co-located
`__tests__/`, no `any`, no `console.log`, every request through
`@/utilities/http`.

---

## Phase 4 — Environments (development / production / optional STAGING)

1. Copy `templates/.env.example` → `.env.example`; create a local `.env.local`
   and fill it in. Ensure `.gitignore` ignores `.env*` **except** `.env.example`
   (`create-vite`'s `.gitignore` already ignores `*.local` — add `.env*` plus a
   `!.env.example` negation).
2. Public vars are prefixed `VITE_` and validated in `src/constants/env.ts`.
   **There is no server-only half here** — this bundle is static and ships to the
   browser in full. A secret in `.env.local` is a secret in the bundle. Server
   config belongs to the API service.
3. If **STAGING** was requested, staging is a Worker environment that builds with
   `VITE_ENV=staging` (and its own `VITE_API_URL`); `APP_ENV` in `env.ts` already
   recognizes it, and Phase 8 shows the `wrangler.jsonc` block. If it was **not**
   requested, nothing to do — the `'staging'` branch stays inert.

---

## Phase 5 — Wire the router, the shell, and the providers

1. Copy `templates/index.html` → `index.html` (overwrite the generated one) and
   set the `<title>` to the app display name.
2. Copy `templates/src/main.tsx` → `src/main.tsx` (overwrite). It creates the
   router, registers it for type safety, imports the two Fontsource families and
   `@/ui/globals.css`, and mounts `<RouterProvider>` inside `<AppProviders>`.
3. Copy `templates/src/app/__root.tsx` → `src/app/__root.tsx` — the shell every
   route renders inside.
4. Create `src/providers/app-providers.tsx`:

```tsx
/** App-wide providers — one component, mounted once from src/main.tsx. */
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  // Wrap with QueryClientProvider / ThemeProvider here as integrations are
  // added (Phase 6). Keep it a single provider component.
  return <>{children}</>;
}
```

5. Create the first feature screen, `src/features/home/screens/home-screen.tsx`:

```tsx
/** The console home screen. */
export function HomeScreen() {
  return <main>Hello from {`{{APP_NAME}}`}</main>;
}
```

6. Copy `templates/src/app/index.tsx` → `src/app/index.tsx` — the `/` route that
   points at it.

Then boot once so the router plugin writes `src/route-tree.gen.ts`:

```bash
bun run dev   # visit http://localhost:5173, then Ctrl-C
```

**Commit the generated `src/route-tree.gen.ts`.** `tsc --noEmit` needs it to
exist on a fresh clone before any build has run, so CI is red without it. It is
already excluded from lint, format, and the AI review.

---

## Phase 6 — Optional integrations (only what Phase 0 selected)

Skip any the user declined. Add a README line under the relevant folder for each.

**6a. API layer** — the dependencies are already installed (Phase 2).

1. Wire a `QueryClientProvider` (with a single `QueryClient`) into
   `AppProviders`. Every screen that loads data needs it.
2. Copy `templates/src/api/orpc.ts` → `src/api/orpc.ts` and point its
   `import type { AppRouter }` at wherever the API's router type comes from —
   a workspace package in a monorepo, or a published contract package when the
   API lives in its own repo (see the `backend-ts` kit → "Sharing the API type").
   It is a **type-only** import, so nothing from the server reaches this bundle.
3. Create `src/api/http-client.ts` (one `createHttpClient` instance reading
   `BASE_API_URL` and `REQUEST_TIMEOUT_MS` from `@/constants/env`) for calls to
   anything that is *not* our API, plus a sample `clients/` file per
   [`STRUCTURE.md`](./STRUCTURE.md).

Then follow the rule in STRUCTURE.md: **our API → `orpc`, everything else →
`http`**. Do not hand-write `queryKey` arrays for oRPC calls — `orpc.<path>.key()`
derives them from the procedure path. No axios, no bare `fetch` in a feature.

**6b. Auth (better-auth)** — `bun add better-auth`. The console holds the
**client** half only:

```ts
// src/api/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { BASE_API_URL } from '@/constants/env';

export const authClient = createAuthClient({ baseURL: BASE_API_URL });
export const { signIn, signOut, useSession } = authClient;

// Usage (current client API):
// const { data: session, isPending } = useSession();
// await signIn.email({ email, password });
// await signIn.social({ provider: 'github' });
// await signOut();
```

Gate routes with a pathless layout route (`src/app/_authed.tsx`) whose
`beforeLoad` redirects when there is no session, and point `http`'s `headers`
hook at the session token if the API expects a bearer header. The server half —
`betterAuth(...)`, the database tables, `/api/auth/*` — belongs to the API
service; see the `backend-ts` kit. Never put `BETTER_AUTH_SECRET` in this
project.

**6c. Same-project Worker API** — only if Phase 0 asked for it.
`bun add -d @cloudflare/vite-plugin` and `bun add hono @tursodatabase/serverless`.
Add `cloudflare()` to the `vite.config.ts` plugin list, create `src/worker.ts`
(a Hono app exporting `default`), and in `wrangler.jsonc` set `"main":
"./src/worker.ts"`, add `"binding": "ASSETS"` to `assets`, and add
`"compatibility_flags": ["nodejs_compat"]`. Turso credentials are Worker secrets
(`.dev.vars` locally, `wrangler secret put` deployed) and are read from the
Worker's `env` — they never touch `src/constants/env.ts`. `src/worker.ts` is a
new top-level entry: add `worker` handling to `scripts/guardrails/run.sh` if you
move it into a folder.

Add a `"cf-typegen": "wrangler types"` script and run it, then commit the
generated `worker-configuration.d.ts` **and add it to `tsconfig.json`'s
`include`**. Committing it is not enough on its own: `wrangler types` writes it
to the project root, the shipped `include` is `["src", "vite.config.ts",
"vitest.setup.ts"]`, and an ambient `.d.ts` outside the program is invisible —
`tsc --noEmit` fails with `Cannot find name 'Env'` even with the file sitting
right there. (The backend-ts stack lists it in `include` for exactly this
reason; console does not, because until this phase it has no Worker.) The kit already ships the plumbing for
that file (it is listed in `.gitattributes`, and excluded from oxlint and the
Lefthook globs), because those entries are harmless while the file is absent and
would otherwise be easy to forget once it appears. Nothing generates it until
you take this path — that is why there is no `cf-typegen` script by default.

For any product integration (Sentry, analytics, Stripe, email), follow
[`LIBRARIES.md`](./LIBRARIES.md) and add it as its own provider/module — never as
a default.

---

## Phase 7 — Design pass

Read [`../../DESIGN.md`](../../DESIGN.md) — the house design language. The theme
tokens copied in Phase 3 already implement it, so the app starts on-language.

**7.1 Fonts are already bound.** `src/main.tsx` imports
`@fontsource-variable/archivo` and `@fontsource-variable/jetbrains-mono`, and
`globals.css` (7.3) declares `--font-sans` / `--font-mono` from them — the exact
variable names `theme/typography.ts` reads. The fonts are self-hosted from
`node_modules`; there is no runtime request to Google Fonts. `data-signal` on
`<html>` in `index.html` picks the signal temperature for the whole product;
omit the attribute for Jade.

**7.2 Apply the intake design context.**

1. If Phase 0 named one of the four house signal temperatures (Jade, Blueprint,
   Ion, Chalk), set `data-signal` on `<html>` in `index.html` **and** change
   `defaultSignal` in `src/ui/theme/colors.ts` to the same name. That pair is the
   whole theming surface — nothing else in either file moves. Setting only
   `data-signal` leaves `colors.accent` in TS on Jade while the page renders the
   other temperature.
2. If Phase 0 described a **different** brand, replace the values in
   `src/ui/theme/{colors,typography}.ts` — but keep the *structure*: alternating
   bands (`colors` + `colorsLight`), one signal with four steps, fixed status
   colours, the mono meta layer, hairline depth. The signal never fills a button;
   no gradients, no glassmorphism, no generic cyan-on-dark.
3. If it did neither, keep the house tokens as shipped and say so in the design
   notes.
4. Record the direction (audience, jobs, tone, palette, and any deviation from
   `DESIGN.md`) in the `## Design notes` section of `CLAUDE.md` so future agents
   inherit the "why".
5. If the design called for **Tailwind**, install it now
   (`bun add tailwindcss @tailwindcss/vite`) and add `tailwindcss()` to the
   `vite.config.ts` plugin list. The token files stay the single source of truth
   — never duplicate hex literals into a Tailwind config. 7.3 is the one place
   the mapping happens.

Do **not** build UI primitives yet — 7.3 introduces the seam they have to read.
Building them here against `colors` / `colorsLight` directly produces exactly the
single-band components 7.3 exists to prevent.

**7.3 Wire the band seam in `src/ui/globals.css`.** The page alternates dark and
light bands, so a primitive that imports one color map directly can only ever
render one band. The seam is a set of `--tone-*` custom properties: `:root`
carries `colors` (the dark band, the default), a `.band-light` class overrides
them with `colorsLight`, and everything downstream reads the variables. A light
band is then `<section className="band band-light">` — `band` paints the ruled
backdrop, `band-light` flips the tokens.

That stylesheet ships as a template — copy the one matching your scaffold:

| Scaffolded with | Copy |
| --- | --- |
| no Tailwind (the Phase 1 default) | `templates/globals.css` |
| Tailwind (`@tailwindcss/vite`) | `templates/globals.tailwind.css` |

Both go to `src/ui/globals.css`, which `src/main.tsx` already imports. They are
not interchangeable. The Tailwind file keeps `@import "tailwindcss";`, drops the
reset (Preflight covers it), wraps its rules in `@layer base`, and adds a
forward-only `@theme inline` alias block; the plain file does none of that and
carries its own reset. Copying the wrong one silently breaks either every utility
class or every UA default.

Both files carry the full token set inline and document the rules that come with
the seam — read the header comment of the one you copy before writing components
against it. Keep the values in lockstep with `src/ui/theme/colors.ts`: the token
file is the source of truth, the stylesheet is its CSS projection.

**7.4 Build the `src/ui/*` primitives** the screens need, composed from the
tokens and reading the `--tone-*` variables (never importing `colors` or
`colorsLight` directly — that pins a component to one band). Include the
patterns the language leans on — section marker, fact rail, index row, status
dot, stat band — where the screens use them, plus one `<Icon>` wrapper over
`theme/icons.ts` that owns the stroke width, square caps and mitred joins so no
mark can drift from the construction rules.

---

## Phase 8 — Cloudflare Workers deploy config

The console deploys as **static assets on Workers** — no server code unless
Phase 6c added a Worker API.

Copy `templates/wrangler.jsonc` → `wrangler.jsonc` and set `"name"` to the
project name. `not_found_handling: "single-page-application"` is what makes a
deep link like `/shifts/42` boot the app instead of 404ing — the router needs it.

If **STAGING** was requested, uncomment the `env.staging` block and give it its
own Worker name. Deploy with `wrangler deploy --env staging`.

Verify the built app serves correctly through the real Workers runtime before
calling this done:

```bash
bun run build
bunx wrangler dev          # serves ./dist through workerd; check a deep link
```

Deploying for real (`bun run deploy`) needs a Cloudflare account and
`wrangler login` — that's on the Phase 11 human checklist.

---

## Phase 9 — CI and the review guard rails

The gate exists at four layers, and this phase installs the last two. See
[`../../CORE.md`](../../CORE.md) → "Quality gates & guardrails" for the full
picture.

```bash
mkdir -p .github/workflows
```

1. Copy `templates/.github/workflows/ci.yml` → `.github/workflows/ci.yml`. It
   runs type-check + lint + fmt:check + check:structure + knip + jscpd + test —
   the same checks as `bun run check`, each as its own named step — and then a
   real production build, on every PR and push to `main`. Keep its `bun-version`
   current.
2. Copy `templates/.github/workflows/code-review.yml` →
   `.github/workflows/code-review.yml`. It reviews every PR against the repo's
   own convention files (read from the **base** ref, so a PR cannot rewrite the
   rules it is judged by) and posts inline findings. It needs an
   `DEEPSEEK_API_KEY` repository secret — that's on the human checklist.

Both are required checks on `main` once branch protection is set up (human
checklist).

---

## Phase 10 — Top-level README

Generate the project `README.md` from `templates/README.md`: description, the
project layout table, environments, scripts, deploy, and CI. Fill the
`{{STAGING_ROW}}` (a staging row if requested, else remove the line). Cross-link
`CLAUDE.md`.

---

## Phase 11 — Verify (run the gate)

Run the full gate and fix anything red before calling setup done:

```bash
bun run check      # tsc + oxlint + oxfmt + guardrails + knip + jscpd + vitest run
bun run build      # production build succeeds
```

> A fresh scaffold can trip **knip** on templates you copied but have not wired
> up yet (an unused `http-client.ts`, say). Fix it by using the file or deleting
> it — that is the check doing its job. Do not add it to `knip.json`'s `ignore`
> to get past the gate.

`bun run check` must exit 0. Report the results honestly — do not mark setup
complete with any gate failing. (A fresh scaffold has no tests yet; `vitest run`
passes on an empty suite via `passWithNoTests`. The first feature brings its own
`__tests__/` with real-data tests.)

---

## Phase 12 — Human-only checklist (print this for the user)

End by printing the checklist of what only a human can do. Tailor it to the
chosen options; the common items:

- [ ] **Cloudflare account**: run `wrangler login`, confirm the account id, and
      run the first `bun run deploy`.
- [ ] **Environment variables**: set the build-time `VITE_*` values for each
      environment (development / staging / production). Remember they are public
      — never put a secret in one.
- [ ] **Worker secrets** (only if Phase 6c wired a Worker API): `wrangler secret
      put TURSO_DATABASE_URL`, `wrangler secret put TURSO_AUTH_TOKEN`, and any
      auth secrets, per environment.
- [ ] **Domain**: add the custom domain to the Worker and confirm TLS.
- [ ] **Auth** (if wired): register the OAuth app(s) with each provider and add
      the client id/secret + `BETTER_AUTH_SECRET` to the **API service**, not to
      this project.
- [ ] **GitHub repo**: create it, push, and add the `DEEPSEEK_API_KEY` secret
      for the code-review workflow.
- [ ] **Branch protection**: require both the **CI** check
      (`.github/workflows/ci.yml`) and a passing **Code Review** on PRs to `main`.

> Once these are done, the console is ready to deploy.
