# Library Reference

The curated toolbox for console apps in this kit. The philosophy is **lean**:
every dependency must earn its place, do one job well, and not duplicate
something the platform, Vite, or React already does. Prefer the standard library
and Web Platform APIs before adding anything here.

Install with **`bun add`** (runtime) or **`bun add -d`** (dev). Lockfile is
committed; CI installs with `--frozen-lockfile`.

---

## Baseline — installed by `SETUP.md` in every console

| Concern | Library | Notes |
| --- | --- | --- |
| Build tool / dev server | `vite` | Also the test runner's engine, so one config covers build and test. |
| UI runtime | `react` + `react-dom` | Upgrade together. |
| Routing | `@tanstack/react-router` + `@tanstack/router-plugin` | Type-safe file-based routing over `src/app/`; the plugin generates `src/route-tree.gen.ts`. |
| Server state | `@tanstack/react-query` v5 | Caching, retries, background refetch, mutations. Mounted via `QueryClientProvider` in `AppProviders`. |
| API client | `@orpc/client` + `@orpc/tanstack-query` | The typed client for our own API, plus its Query bindings. Query keys derive from the procedure path — no key factory to write. |
| Validation | `zod` (v4) | Every boundary: env, any response this app parses itself, form schemas. Types come from `z.infer`. |
| Dead code / unused deps | `knip` | Gate step. Fails on an unused file, export, or dependency. |
| Copy-paste detection | `jscpd` | Gate step, `threshold: 0` + `exitCode: 1`. |
| Fonts | `@fontsource-variable/archivo` + `@fontsource-variable/jetbrains-mono` | The two families the design language names, self-hosted — no runtime request to Google. |
| Testing | `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom` | Component tests in a jsdom environment. |
| Test tooling | `@vitejs/plugin-react` + `vite-tsconfig-paths` | JSX transform + `@/*` alias resolution, shared by build and test. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Git hooks | `lefthook` | Pre-commit lint + format on staged files. |
| Deploy | `wrangler` (dev dependency) | Cloudflare Workers CLI — the house deploy target. |

### Two ways to call something, and when to use which

**Our own API → oRPC.** Procedures are declared once on the server with Zod
input and output schemas; the client is typed from that same declaration, so a
renamed field is a compile error here rather than a runtime `undefined` in
production. With `@orpc/tanstack-query` every procedure gets `queryOptions` /
`mutationOptions` / `key`, and the query key comes from the procedure path:

```ts
const { data } = useQuery(orpc.shifts.list.queryOptions({ input: { locationId } }));
const create = useMutation(orpc.shifts.create.mutationOptions());
queryClient.invalidateQueries({ queryKey: orpc.shifts.key() });
```

**Anything else → `src/utilities/http.ts`.** Third-party APIs, a webhook probe,
a file download — anything that isn't our own oRPC service. It ships **with the
kit**, not from npm: a `fetch` wrapper exporting `createHttpClient` with
`get`/`post`/`put`/`patch`/`delete`, a base URL, per-request timeouts, a
resolved-per-request headers hook (where auth goes), and typed `HttpError` /
`HttpAbortError`.

Its one opinion worth knowing: a response comes back as **`unknown`** unless you
pass a `parse` function — and that function is a Zod schema:

```ts
const raw = await http.get('/rates');                                  // unknown
const rates = await http.get('/rates', { parse: (b) => Rates.parse(b) }); // Rates
```

That is CORE rule 13 made structural: because the config bans type assertions,
the only way to get a typed body out of this client is to hand it something that
actually validates one. Extend `http.ts` rather than reaching for a library.

---

## Reach-for-these — add when the project needs them

The **approved** choice for each job. The setup guide asks whether to wire the
backend ones; add the rest as features demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Auth | **`better-auth`** | The house auth. The console uses the **client** half (`better-auth/react` → `createAuthClient`, `useSession`, `signIn`, `signOut`); the server half lives in the `backend-ts` service (or this project's opt-in Worker API) and owns the database. Never put an auth secret in this bundle. |
| Database | **Turso** via `@tursodatabase/serverless` | Only if you opted into the same-project Worker API — the DB is reachable from the Worker, never from the browser. See the `backend-ts` kit for the full pattern. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | Performant, uncontrolled-by-default forms. The form's Zod schema is the same kind of schema everything else uses; where the field shapes match a procedure's input, derive it from that schema rather than restating it. |
| Dates | `date-fns` | Tree-shakeable, immutable. For formatting only, prefer the built-in `Intl.DateTimeFormat` / `Intl.NumberFormat` first. |
| Styling (opt-in) | `tailwindcss` + `@tailwindcss/vite` | Only if the design context asks for it. The theme tokens stay the source of truth — see `globals.tailwind.css`. |
| Icons | `lucide-react` | Tree-shakeable SVG icon set. Import only the icons you use; don't pull a whole icon font. |
| Router devtools | `@tanstack/react-router-devtools` | Dev-only. Mount inside `__root.tsx` behind an `import.meta.env.DEV` check. |

---

## AVOID — and why

Do not add these without an explicit, documented reason.

| Library | Avoid because | Use instead |
| --- | --- | --- |
| **`axios`** | A dependency for something the platform already does. `fetch` is native in every runtime we ship to, and axios adds a second error model, its own cancellation story, and a bundle cost — while still needing a wrapper to be usable. | **`src/utilities/http.ts`** — the kit's fetch client. Blocked by `no-restricted-imports` *and* by `check-structure.sh` reading `package.json`. |
| Bare `fetch` scattered through features | Base URL, auth headers, timeouts and error shaping get re-implemented (differently) at each call site. | `orpc` for our API; the one configured `http` client for everything else. |
| Hand-written `queryKey` arrays for oRPC calls | Two places to keep in sync, and an invalidation that silently matches nothing when they drift. | `orpc.<path>.key()` — derived from the procedure path. |
| `trpc` | Same idea, but oRPC is the one this kit picked: it speaks OpenAPI as well as RPC, and its schema story is plain Zod. Running both means two clients and two conventions. | `@orpc/client`. |
| `next` / any meta-framework | This stack is deliberately a client-rendered SPA on static assets. Server rendering belongs to the `marketing` stack (Astro) or a real API service. | `marketing` for content; `backend-ts` for server work. |
| Redux / Redux Toolkit | Boilerplate-heavy for app state; overlaps React Query for server state. | React Query (server state) + React Context / local state (rare global client state). |
| `zustand` (and other global client-state stores) | Most "global" state is either server state (React Query or a route loader) or screen-local. A standalone store invites duplicating server data and over-globalizing. | React Query for server state; `useState`/`useReducer` + a small React Context (`src/providers/`) for genuinely global client state (session, theme). |
| `yup` / `valibot` / `joi`, or hand-written type guards | The kit has one validator. A second one means two ways to describe the same shape and no single place to read it. | **`zod`** — env, response bodies, forms, storage. Types via `z.infer` (CORE rule 13). |
| A type declared next to its schema (`interface Shift` beside `const Shift = z.object(...)`) | They drift, silently, and the compiler cannot tell you which one is right. | `type Shift = z.infer<typeof Shift>`. |
| `moment` | Huge, mutable, deprecated. | `date-fns`, or the built-in `Intl` APIs. |
| CSS-in-JS runtimes (`styled-components`, `emotion`) | Runtime cost for something CSS variables already solve, and they fight the band seam. | CSS Modules / plain CSS referencing `src/ui/theme/*` tokens. |
| `react-router` (alongside TanStack Router) | Two routers is two route trees, two link components, and no type safety across the seam. | `@tanstack/react-router` — the one router. |
| Global state for server data | Server data cached in a client store goes stale and desyncs. | React Query, or a route loader. |

**Global state with React Context** — the alternative to `zustand` / Redux. For
the rare genuinely-global client state (session, theme, selected workspace), use
`createContext` + `useReducer` and mount a provider in `src/providers/`. React's
official guides cover the whole pattern:

- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)

(Server data still belongs in React Query or a route loader — not in Context.)

---

## Product integrations (opt-in, not baseline)

Don't pull these in by default — add per project when the feature exists:
**Sentry** (errors), **PostHog / Segment** (analytics), **Stripe** (payments),
**Resend** (email). Each is a setup-time question, not a default dependency.

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` or `src/ui/` with attribution) over an npm dependency when the
library is tiny (a few functions), unmaintained, or you only need a slice of it.
Vendor with a header comment citing the source + license, and a test. Treat
vendored code as ours — lint it, type it, test it. `src/utilities/http.ts` is the
pattern: the kit owns it, so it is linted, typed, and tested like any other file.
