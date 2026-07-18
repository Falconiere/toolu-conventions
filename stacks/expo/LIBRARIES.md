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
| Server state / data fetching | `@tanstack/react-query` v5 | Caching, retries, background refetch. The default for anything async. |
| Dates | `date-fns` | Tree-shakeable, immutable, no global state. `format`, `parseISO`, `differenceInHours`, etc. |
| SVG | `react-native-svg` | Required by icons and any vector asset. |
| Animation | `react-native-reanimated` | Ships with Expo; the standard for performant animation. |
| Gestures | `react-native-gesture-handler` | Peer of Reanimated / navigation. |
| Safe area | `react-native-safe-area-context` | Insets for notches/home indicator. |
| Testing | `jest` + `jest-expo` + `@testing-library/react-native` | Unit/component tests, real data. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | Fast Rust tooling. |
| Git hooks | `lefthook` | Pre-commit lint + format. |

---

## Reach-for-these — add when the project needs them

These are the **approved** choice for their job. The setup guide asks whether to
wire the opt-in ones (API layer, auth, local storage); add the rest as features
demand.

| Concern | Library | When / why |
| --- | --- | --- |
| Action / bottom sheets | **`react-native-actions-sheet`** | Sheets, menus, pickers. Imperative `SheetManager` API. **Use this, not `@gorhom/bottom-sheet`.** |
| HTTP client | `axios` | When you opt into an API layer. Interceptors for auth + a custom `ApiError`. |
| Forms | `react-hook-form` (+ optional `zod` + `@hookform/resolvers`) | Performant, uncontrolled-by-default forms. Built-in rules for simple validation; add `zod` + `zodResolver` only when a form needs richer schema validation — and keep the schema scoped to that form, never as an app-wide layer. |
| Local key-value storage | `@react-native-async-storage/async-storage` | The opt-in local-storage integration. Async API, no native config beyond install. Good for cache, flags, small persisted UI state. |
| Secure storage / tokens | `expo-secure-store` | Auth tokens + secrets (Keychain / Keystore). Backs the opt-in auth scaffold. |
| Auth scaffold | `expo-secure-store` + a custom `AuthProvider` | The baseline auth is a generic token-based provider in `src/providers/` backed by secure storage, wired into the axios interceptor and a `(auth)` route group. A hosted auth vendor (Clerk, Auth0, SuperTokens, …) is opt-in per project — add its SDK then, not by default. |
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
| `react-native-unistyles` | Heavy theming/breakpoint runtime + TS module augmentation for what plain styles do fine. Couples every component to it. | `StyleSheet.create` + the plain `src/ui/theme/*` token files. |
| `nativewind` / Tailwind-in-RN | A second styling paradigm on top of `StyleSheet`; class strings dodge the theme tokens. | `StyleSheet.create` + `src/ui/theme/*`. |
| `@gorhom/bottom-sheet` | Large, gesture-heavy, native complexity for behavior most apps don't need. | `react-native-actions-sheet`, or a screen/route. |
| `moment` | Huge, mutable, deprecated. | `date-fns`. |
| Schema-validation libs *app-wide* (`zod`, `yup`, `valibot`, `joi`) for env / API parsing / general data | Extra runtime + a parallel type system to maintain across the whole app. The baseline validates env + external data by hand. | Hand-written type guards on `unknown` (the lint config already mandates `unknown` + guards over `any`). **Exception:** `zod` is fine *scoped to a single form's validation* with `react-hook-form` + `zodResolver` — see Forms above. |
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
