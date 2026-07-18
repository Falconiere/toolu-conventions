# Library Reference

The curated toolbox for web apps in this kit. The philosophy is **lean**: every
dependency must earn its place, do one job well, and not duplicate something the
platform, Next.js, or React already does. Prefer the standard library / Web
Platform APIs / built-in Next features before adding anything here.

Install with **`bun add`** (runtime) or **`bun add -d`** (dev). Lockfile is
committed; CI installs with `--frozen-lockfile`.

---

## Baseline — installed by `SETUP.md` in every app

| Concern | Library | Notes |
| --- | --- | --- |
| Framework / routing | `next` (App Router) | File-based routing, Server Components, route handlers. |
| UI runtime | `react` + `react-dom` | Managed by Next; upgrade together. |
| Testing | `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom` | Component tests in a jsdom environment. |
| Test tooling | `@vitejs/plugin-react` + `vite-tsconfig-paths` | JSX transform + `@/*` alias resolution for Vitest. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Git hooks | `lefthook` | Pre-commit lint + format on staged files. |

Data fetching (`@tanstack/react-query`) is **not** baseline — it's added when you
opt into the API layer (see below), because a Server-Component-first app often
fetches on the server and needs no client cache at all.

---

## Reach-for-these — add when the project needs them

The **approved** choice for each job. The setup guide asks whether to wire the
backend ones; add the rest as features demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Client-side server state | **`@tanstack/react-query`** v5 | Caching, retries, background refetch for data fetched **on the client** (interactive lists, mutations, polling). Wrapped in an `AppProviders` client component. For data that can be fetched on the server, fetch in a Server Component instead. |
| HTTP client | `axios` | When you opt into an API layer. Interceptors for auth + a typed `ApiError`. Plain `fetch` is fine for simple cases — reach for axios when you want interceptors/instances. |
| Auth | **Auth.js (`next-auth` v5)** | Sessions, OAuth/credentials, middleware-guarded routes. The route handler lives at `src/app/api/auth/[...nextauth]/route.ts`. |
| Database client | **`drizzle-orm`** (typed SQL) | When the app owns a database. Type-safe, lightweight, no heavy runtime. Server-only — never import a DB client into a Client Component. `bun:sql` / `postgres` are fine for thin query layers. |
| Forms | `react-hook-form` (+ optional `zod` + `@hookform/resolvers`) | Performant, uncontrolled-by-default forms. Built-in rules for simple validation; add `zod` + `zodResolver` only when a form needs richer schema validation — and keep the schema scoped to that form, never app-wide. |
| Dates | `date-fns` | Tree-shakeable, immutable. For formatting only, prefer the built-in `Intl.DateTimeFormat` / `Intl.NumberFormat` first. |
| Theming (light/dark) | `next-themes` | **Only if** the app needs a user-toggleable or system-synced color scheme. If a single theme (or pure CSS `prefers-color-scheme`) is enough, skip it — it's a client provider you don't need otherwise. |
| Icons | `lucide-react` | Tree-shakeable SVG icon set. Import only the icons you use; don't pull a whole icon font. |

---

## AVOID — and why

Do not add these without an explicit, documented reason.

| Library | Avoid because | Use instead |
| --- | --- | --- |
| Redux / Redux Toolkit | Boilerplate-heavy for app state; overlaps React Query for server state. | React Query (server state) + React Context / local state (rare global client state). |
| `zustand` (and other global client-state stores) | Most "global" state is either server state (belongs in React Query or a Server Component) or screen-local. A standalone store invites duplicating server data and over-globalizing. | React Query for server state; `useState`/`useReducer` + a small React Context (`src/providers/`) for genuinely global client state (session, theme). |
| Schema-validation libs **app-wide** (`zod`, `yup`, `valibot`, `joi`) for env / API parsing / general data | Extra runtime + a parallel type system to maintain across the whole app. The baseline validates env + external data by hand. | Hand-written type guards on `unknown` (the lint config already mandates `unknown` + guards over `any`). **Exception:** `zod` scoped to a single form's validation with `react-hook-form` + `zodResolver`. |
| `moment` | Huge, mutable, deprecated. | `date-fns`, or the built-in `Intl` APIs. |
| CSS-in-JS runtimes (`styled-components`, `emotion`) | Runtime cost and awkward fit with Server Components (they force `'use client'`). | CSS Modules / plain CSS referencing `src/ui/theme/*` tokens. (Tailwind is a fine opt-in at setup if the design calls for it.) |
| `axios` **everywhere** by reflex | The Web `fetch` API is built in and works in Server Components. | Plain `fetch` for simple requests; add `axios` only when you want instances/interceptors. |
| Global state for server data | Server data cached in a client store goes stale and desyncs. | React Query, or fetch fresh in a Server Component. |

**Global state with React Context** — the alternative to `zustand` / Redux. For
the rare genuinely-global client state (session, theme, selected workspace), use
`createContext` + `useReducer` and mount a provider in `src/providers/`. React's
official guides cover the whole pattern:

- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)

(Server data still belongs in React Query or a Server Component — not in Context.)

---

## Product integrations (opt-in, not baseline)

Don't pull these in by default — add per project when the feature exists:
**Sentry** (errors), **PostHog / Segment** (analytics), **Stripe** (payments),
**Resend** (email), **Vercel Analytics / Speed Insights**. Each is a setup-time
question, not a default dependency.

---

## Non-Next variant: Vite

This kit ships **Next.js** as the default because most web apps want the App
Router, Server Components, and file-based routing. For a project that is a pure
client-side SPA with **no server needs** (an internal dashboard, an embedded
widget, a static tool), **Vite** is the sanctioned alternative:

- Scaffold with `bun create vite <app> --template react-ts` instead of
  `create-next-app`, then apply the same `src/` structure, tokens, and tooling.
- **Everything else carries over unchanged**: the folder layout in
  `STRUCTURE.md`, the `@/*` path alias (Vite reads it via `vite-tsconfig-paths`),
  oxlint + oxfmt, Lefthook, and the theme tokens. Vitest is already Vite-native,
  so the test config gets *simpler* (drop `vite-tsconfig-paths` duplication —
  Vite's own config supplies the alias).
- The differences to drop: no `src/app/` routes (use a router like
  `react-router` or `@tanstack/router`), no Server/Client Component split (it's
  all client), no `next.config.ts`, and `NEXT_PUBLIC_*` becomes `VITE_*` (read
  via `import.meta.env`).

Choose Vite only when you are sure you need **no** server rendering or server
routes — otherwise Next.js is the default and the safer long-term call.

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` or `src/ui/` with attribution) over an npm dependency when the
library is tiny (a few functions), unmaintained, or you only need a slice of it.
Vendor with a header comment citing the source + license, and a test. Treat
vendored code as ours — lint it, type it, test it.
