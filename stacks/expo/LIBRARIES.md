# Library Reference — Expo

The curated toolbox for apps in this stack. The philosophy is **lean**: every
dependency must earn its place, do one job well, and not duplicate something the
platform or an existing dep already does. Prefer the standard library / Expo
modules / plain React Native before adding anything here.

Install RN-native libs with **`bunx expo install <pkg>`** (not `bun add`) so Expo
picks the version compatible with your SDK.

---

## Baseline — installed by `SETUP.md` in every app

| Concern | Library | Notes |
| --- | --- | --- |
| Routing | `expo-router` | File-based, typed routes. |
| Server state / data fetching | `@tanstack/react-query` v5 | Caching, retries, background refetch. **House default** (CORE) for anything async. |
| Forms | `@tanstack/react-form` + `zod` | **House default** (CORE). Pass Zod schemas directly via Standard Schema (`validators: { onChange: schema }`) — do **not** add `@tanstack/zod-form-adapter`. Same form stack as the console. |
| Dates | `date-fns` | Tree-shakeable, immutable, no global state. `format`, `parseISO`, `differenceInHours`, etc. |
| SVG | `react-native-svg` | Required by icons and any vector asset. |
| Animation | `react-native-reanimated` | Ships with Expo; the standard for performant animation. |
| Gestures | `react-native-gesture-handler` | Peer of Reanimated / navigation. |
| Safe area | `react-native-safe-area-context` | Insets for notches/home indicator. |
| Validation | `zod` (v4) | Every boundary: env, parsed responses, forms, storage. Types come from `z.infer`. |
| Testing | `jest` + `jest-expo` + `@testing-library/react-native` | Unit/component tests, real data. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Dead code / unused deps | `knip` | Gate step. Fails on an unused file, export, or dependency. |
| Copy-paste detection | `jscpd` | Gate step, `threshold: 0` + `exitCode: 1`. |
| Git hooks | `lefthook` | Pre-commit lint + format. |

---

## Reach-for-these — add when the project needs them

These are the **approved** choice for their job. The setup guide asks whether to
wire the opt-in ones (API layer, auth, local storage); add the rest as features
demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Action / bottom sheets | **`react-native-actions-sheet`** | Sheets, menus, pickers. Imperative `SheetManager` API. **Use this, not `@gorhom/bottom-sheet`.** |
| API client (our own API) | **`@orpc/client` + `@orpc/tanstack-query`** | The typed client for our own service, plus its TanStack Query bindings. Query keys derive from the procedure path — no key factory to write. Same client the console uses. |
| Validation | **`zod`** (v4) | Every boundary: env, any response the app parses itself, form schemas. Types come from `z.infer`. |
| HTTP client (everything else) | **`src/utilities/http.ts`** (ships with the kit, not npm) | The house fetch client — `createHttpClient` gives `get`/`post`/`put`/`patch`/`delete`, a base URL, per-request timeouts, a headers hook for the auth token, and typed `HttpError`/`HttpAbortError`. Copy it from `stacks/console/templates/utilities/http.ts`; it is written to run on Hermes (no `AbortSignal.timeout`/`any`). **Not axios** — see AVOID. |
| Local key-value storage | `@react-native-async-storage/async-storage` | The opt-in local-storage integration. Async API, no native config beyond install. Good for cache, flags, small persisted UI state. |
| Secure storage / tokens | `expo-secure-store` | Auth tokens + secrets (Keychain / Keystore). Backs the opt-in auth scaffold. |
| Auth | **`better-auth`** (+ `expo-secure-store`) | The house auth (CORE). The app uses the **client** half (`better-auth/react` → `createAuthClient`, `useSession`, `signIn`, `signOut`) with its Expo plugin storing the session in `expo-secure-store`; the server half lives in the `backend-ts` service and owns the database. Point the `http` client's `headers` hook at the session token and gate routes with an `(auth)` route group. Check better-auth's current Expo docs for the plugin's exact setup — it moves faster than this kit. |
| Icons | `@react-native-vector-icons/feather` + `@react-native-vector-icons/material-design-icons` | Lean subset — do **not** install all icon families. |
| Images | `expo-image` | Caching, transitions, better perf than `<Image>`. |

---

## Use with caution — it depends

Not banned, not a default. Adopt one of these **only when the trade-off clearly
favors it for this project**, and write the reasoning down (in the relevant
`README`/PR) so the next person or agent understands the call. Re-evaluate if the
assumption that justified it changes.

| Library | Lean in when… | Skip when… |
| --- | --- | --- |
| `orval` (OpenAPI → client + types codegen) | The API changes **frequently** and ships a reliable OpenAPI/Swagger spec. Regenerating keeps the client and types in lockstep with the backend, and the large diff on each spec change is exactly the signal you want — you see the full blast radius of every API change instead of discovering breakage at runtime. | The API is **stable**, small, or you don't control the spec's quality. Then the generated client, the fixup scripts it needs, and the churny diffs cost more than they save — hand-write `api/clients` + `api/queries` (see STRUCTURE.md). |
| `react-native-mmkv` v4 | You need **synchronous**, perf-critical key-value storage (frequent reads on a hot path) and can carry the native dependency. Use the v4 direct API. | Async storage is fine — then `@react-native-async-storage/async-storage` is the lighter baseline choice and the sanctioned integration. |

> Rule of thumb for `orval`: the faster the API moves, the more codegen earns its
> keep; the more stable it is, the less it's worth fussing with. Know the impact
> of an API change before you choose — that impact is the whole decision.

---

## AVOID — and why

These are common bloat/confusion sources. Do not add them without an explicit,
documented reason.

| Library | Avoid because | Use instead |
| --- | --- | --- |
| **`axios`** | A dependency for something the platform already does. `fetch` is in Hermes, and axios brings its own error model, its own cancellation story, and bundle weight — while still needing a wrapper to be usable. | **`src/utilities/http.ts`** — the kit's fetch client, copied from the console kit. |
| Bare `fetch` scattered through features | Base URL, auth headers, timeouts and error shaping get re-implemented (differently) at each call site. | The one configured client from `src/api/http-client.ts`. |
| `react-native-unistyles` | Heavy theming/breakpoint runtime + TS module augmentation for what plain styles do fine. Couples every component to it. | `StyleSheet.create` + the plain `src/ui/theme/*` token files. |
| `nativewind` / Tailwind-in-RN | A second styling paradigm on top of `StyleSheet`; class strings dodge the theme tokens. | `StyleSheet.create` + `src/ui/theme/*`. |
| `@gorhom/bottom-sheet` | Large, gesture-heavy, native complexity for behavior most apps don't need. | `react-native-actions-sheet`, or a screen/route. |
| `react-hook-form` / Formik / Final Form | A second form stack next to the house choice. | **`@tanstack/react-form`** + Zod (CORE). |
| `@tanstack/zod-form-adapter` / `zodValidator` | Deprecated. TanStack Form accepts Zod via Standard Schema natively. | Pass the Zod schema in `validators` directly. |
| `moment` | Huge, mutable, deprecated. | `date-fns`. |
| `yup` / `valibot` / `joi`, or hand-written type guards | The kit has one validator. A second one means two ways to describe the same shape and no single place to read it. | **`zod`** — env, parsed responses, forms, storage. Types via `z.infer` (CORE rule 13). |
| A type declared beside its schema | They drift, silently, and the compiler cannot say which is right. | `type X = z.infer<typeof X>`. |
| A hand-written `queryKey` array for an oRPC call | Two places to keep in sync, and an invalidation that silently matches nothing once they drift. | `orpc.<path>.key()`. |
| Redux / Redux Toolkit | Boilerplate-heavy for app state; overlaps React Query for server state. | React Query (server state) + React Context / local state (the rare global client state). |
| `zustand` (and other global client-state stores) | Most "global" state is either server state (belongs in React Query) or screen-local. A standalone store invites duplicating server data and over-globalizing. | React Query for server state; `useState`/`useReducer` + a small React Context for genuinely global client state (session, theme). |
| `@shopify/flash-list` | Extra native dependency for what RN core already does; easy to reach for preemptively. | `FlatList` / `SectionList` (virtualized in core) — tune `keyExtractor` / `getItemLayout` / window size before adding anything. |
| Multiple icon families | Bundle bloat. | Feather + Material Design subset. |
| `nitro-modules`, network-logger in prod, etc. | Specialized/experimental; add only with cause. | Stick to Expo modules. |

**Global state with React Context** — the alternative to `zustand` / Redux / other
store libraries. For the rare genuinely-global client state (session, theme,
selected location), use `createContext` + `useReducer` and mount a provider in
`src/providers/`. React's official guides cover the whole pattern:

- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) — the primer: `createContext`, `useContext`, provider components.
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) — the app-wide pattern: `useReducer` + Context as a lightweight store, no library needed.

(Server data still belongs in React Query — don't put it in Context.)

---

## Product integrations (opt-in, not baseline)

Don't pull these in by default — add per project when the feature exists:
**Sentry** (errors), **LaunchDarkly** (flags), **Segment / Braze / Heap**
(analytics), **Sendbird** (chat), **Firebase** (push), **Cloudinary** (images),
**Stripe** (payments). Each is a setup-time question, not a default dependency.

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` or `src/ui/` with attribution) over adding an npm dependency
when:

- The library is tiny (a few functions) — a dependency + its transitive tree
  isn't worth it.
- It's unmaintained or has a history of breaking on RN/Expo upgrades.
- You only need a slice of it.

Vendor with: a header comment citing the source + license, and a test. Treat
vendored code as ours (lint it, type it, test it). Don't vendor anything with a
native module — those must be real dependencies.
