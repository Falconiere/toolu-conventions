# SETUP — Expo app

You are a coding agent scaffolding a new Expo + TypeScript app from this kit.
**Follow this file top to bottom, executing each step.** When a step references a
template, read it from this kit's `templates/` directory and copy it to the stated
destination — do not invent config from memory. Replace every `<placeholder>` with
the intake answer.

**Target baseline (non-negotiable):** Expo (latest SDK) · TypeScript (strict) ·
Expo Router (typed routes) · bun · Jest (`jest-expo`) · oxlint + oxfmt · Lefthook
· EAS · the layout and conventions in [`STRUCTURE.md`](./STRUCTURE.md) · the lean
library set in [`LIBRARIES.md`](./LIBRARIES.md) · the house rules in
[`../../CORE.md`](../../CORE.md). The app is **backend-agnostic** by default —
only wire API/auth/storage if the intake says to.

Read [`STRUCTURE.md`](./STRUCTURE.md), [`LIBRARIES.md`](./LIBRARIES.md),
[`../../CORE.md`](../../CORE.md), and [`../../DESIGN.md`](../../DESIGN.md) before
you start — the theme tokens copied in Phase 3 already implement DESIGN.md.

---

## Phase 0 — Prerequisites

Run these and confirm each; if any is missing, install it (or tell the user how)
and stop until resolved:

```bash
git --version
node --version      # >= 20
bun --version       # package manager for this project
npx expo --version  # Expo CLI (via npx; no global install needed)
eas --version       # EAS CLI — required for builds/submits (Phases 6, 6.5, checklist)
```

If `eas --version` fails, install it and re-check:

```bash
bun add -g eas-cli      # or: npm i -g eas-cli
eas --version
```

## Phase 0.1 — Intake (from the root router)

The root `SETUP.md` collected these. If you're running this file directly, ask
for them now:

1. **Project name** — kebab-case; used for the directory, slug, and bundle/app ids.
2. **Staging environment?** — DEV + PRODUCTION are always created. Add STAGING?
   (default: no.)
3. **Optional integrations** (each opt-in, default *no*):
   - **API layer** — `src/api/` clients + React Query hooks (Phase 8a).
   - **Auth scaffold** — `expo-secure-store` token storage + an `AuthProvider`
     (Phase 8b).
   - **Local storage** — `@react-native-async-storage/async-storage` (Phase 8c).
4. **Design context** — free-text brand/look (colors, tone, reference apps). Feeds
   the theme token values (Phase 7) and the `CLAUDE.md` design-notes section.

Echo back a short summary before scaffolding.

---

## Phase 1 — Scaffold the Expo app

From the new project directory (empty, or create it):

```bash
bunx create-expo-app@latest . --template default
```

The `default` template gives TypeScript + Expo Router. Make bun the package
manager and do a clean install:

```bash
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml
bun install
```

### Normalize the template output

The current SDK (57) `default` template scaffolds routes under **`src/app/`** and
ships demo content (example screens, components, hooks, a reset script, an
`AGENTS.md`, its own `CLAUDE.md`, a `.claude/` dir). This kit uses a **top-level
`app/`** for routes (see [`STRUCTURE.md`](./STRUCTURE.md)) and its own `CLAUDE.md`
(Phase 3), so move the router dir up and strip the demo files first:

```bash
# Routes live at top-level app/ in this kit — move them up if the template used src/app/.
[ -d src/app ] && mkdir -p app && mv src/app/* app/ && rmdir src/app

# Remove template demo content (keep app/_layout.tsx only).
rm -rf src/components src/hooks src/constants src/global.css .claude
rm -f AGENTS.md CLAUDE.md scripts/reset-project.js
rm -f app/explore.tsx   # demo tab route — imports the deleted demo modules

# Remove unreferenced template art (app.json is gone; app.config.ts uses assets/icons/*).
rm -rf assets/images assets/expo.icon

# Prune demo-only deps that the deleted files imported.
bun remove @expo/ui expo-device expo-glass-effect expo-symbols expo-web-browser expo-image
```

> The demo set is **SDK-version-specific** (this is the SDK 57 list). A future
> template may ship a different set — prune whatever the demo files you just
> deleted imported, and **keep any asset your design context actually wants**
> (move it out of `assets/images/` first if so). Add back any pruned dep later via
> `bunx expo install <pkg>` when a real feature needs it (e.g. `expo-image`, which
> LIBRARIES.md lists as opt-in).

Both `app/index.tsx` **and** `app/_layout.tsx` from the SDK 57 template import the
just-deleted demo modules (the layout pulls in `@/components/...` like
`animated-icon` / `app-tabs`). The kit replaces both later — the route in Phase 3,
the layout in Phase 5 — so until then, neutralize each with a self-contained
placeholder so the intermediate checkpoints and the forced bundle below stay green.

`app/index.tsx`:

```tsx
// Placeholder route — replaced by the thin home route in Phase 3.
export default function Index() {
  return null;
}
```

`app/_layout.tsx`:

```tsx
// Placeholder layout — replaced by the provider stack in Phase 5.
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
```

Also delete the `reset-project` entry from `package.json` `scripts` — it points at
the file you just removed. (If the template left no `src/app/`, only the demo
cleanup applies.)

**Boot check — force a real bundle.** A running Metro bundler is NOT proof the app
compiles: Metro only bundles a route when it's first requested, so a broken import
in an unopened route stays hidden (exactly how the demo routes above slip through).
Force a full bundle and require it to exit 0:

```bash
bunx expo export --platform ios --output-dir .expo-export-check && rm -rf .expo-export-check
```

Any orphaned import (a demo file that survived the cleanup) fails here. Re-run this
after Phase 3 once the real routes + primitives are wired.

---

## Phase 2 — Baseline dependencies & tooling

Install the exact testing + lint/format tooling and always-on runtime libs:

```bash
# Testing. jest is pinned to 29 — jest-expo (SDK 57) is jest-29-based and jest 30
# crashes with `this._moduleMocker.clearMocksOnScope is not a function`. Unpin
# once jest-expo supports jest 30. `test-renderer` is the react-native-testing-
# library v14 peer (replaces the old react-test-renderer).
bun add -d jest@~29.7.0 jest-expo @testing-library/react-native @types/jest@^29 test-renderer@^1

# Lint / format / gate + git hooks
bun add -d oxlint oxfmt oxlint-tsgolint knip jscpd lefthook

# Always-on runtime libs (see LIBRARIES.md "Baseline")
bunx expo install react-native-svg react-native-reanimated react-native-gesture-handler react-native-safe-area-context
bun add @tanstack/react-query date-fns zod
```

Copy these templates into the project root:

| Source (in this kit) | Destination (in project) |
| --- | --- |
| `templates/tsconfig.json` | `tsconfig.json` |
| `templates/.oxlintrc.json` | `.oxlintrc.json` |
| `templates/.oxfmtrc.json` | `.oxfmtrc.json` (sets `singleQuote` — oxfmt defaults to double quotes) |
| `templates/lefthook.yml` | `lefthook.yml` |
| `templates/jest.config.js` | `jest.config.js` |
| `templates/jest.setup.ts` | `jest.setup.ts` |
| `templates/knip.json` | `knip.json` (unused files/exports/dependencies) |
| `templates/.jscpd.json` | `.jscpd.json` (copy-paste detection; **keep `"exitCode": 1`** — jscpd 5.x already exits 1 on a breach, so this pins the behaviour against an unpinned version bump; 4.x exited 0) |
| `templates/scripts/check-structure.sh` | `scripts/check-structure.sh` (`mkdir -p scripts` first) |

Copy the lefthook config **before** installing hooks. Use the `.yml` extension:
lefthook 2.x's `install` generates a `lefthook.yml` stub that **shadows** a
`lefthook.yaml`, so hooks silently never install. If a stub `lefthook.yml` already
exists from a prior run, overwrite it with `templates/lefthook.yml`. Then install:

```bash
bunx lefthook install
```

Set these scripts in `package.json`. This block **overrides** the values
`create-expo-app` generated for `start`/`ios`/`android`/`web` (e.g. `ios` →
`expo run:ios`) — replace them, don't keep both:

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "web": "expo start --web",
    "type-check": "tsc --noEmit",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "test": "jest --watchAll=false --coverage=false",
    "test:changed": "jest --watchAll=false --coverage=false --changedSince=origin/main",
    "check:structure": "bash scripts/check-structure.sh",
    "check:unused": "knip",
    "check:dupes": "jscpd",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the one-command gate, in CORE gate order: `tsc --noEmit` +
`oxlint --deny-warnings` + `oxfmt --check` + `bash scripts/check-structure.sh` +
`jest`. The structure script enforces the folder rules the linter can't see
(allowed `src/` dirs, per-folder READMEs, no barrel files, `lefthook.yml` not
`.yaml`); oxlint's `no-restricted-imports` + `unicorn/filename-case` + `max-lines`
carry the import/naming/size rules.

No manual Babel edit is needed for Reanimated. On SDK 50+ with Reanimated 4,
`babel-preset-expo` auto-wires the worklets plugin (`react-native-worklets/plugin`)
— do **not** hand-add the Reanimated Babel plugin to `babel.config.js`.

Create the Expo ambient types file **before any type-check runs**. Write
`expo-env.d.ts` at the project root with exactly this content (byte-identical to
what `expo start` generates later):

```ts
/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be committed with your source code. It is auto-generated by Expo during `expo start`.
```

It's referenced by `tsconfig.json`. Without it, `process.env.EXPO_PUBLIC_*`
resolves to `any` and type-aware oxlint flags `no-unsafe-assignment` in
`app.config.ts` / `src/constants/env.ts` at the gate. It's normally written by
`expo start`/prebuild (which don't run until Phase 10), so create it now.
(`bunx expo customize expo-env.d.ts` does **not** work on SDK 57 — `expo-env.d.ts`
is no longer a `customize` target.) It stays git-ignored (`create-expo-app`
already lists it in `.gitignore`).

Confirm `bun run type-check` and `bun run lint` pass on the bare project.

---

## Phase 3 — Folder skeleton, theme, primitives, CLAUDE.md

Build the tree from [`STRUCTURE.md`](./STRUCTURE.md):

```bash
mkdir -p src/ui/theme src/ui/__tests__ src/features/home/screens src/api/clients \
         src/api/queries src/utilities src/providers src/constants src/types \
         assets assets/icons/dev assets/icons/prod
# Keep the variant icon dirs in git until real icons land (Phase 11 human step).
touch assets/icons/dev/.gitkeep assets/icons/prod/.gitkeep
```

`app.config.ts` (Phase 4) resolves the app icon from `./assets/icons/dev` (test
variant) and `./assets/icons/prod` (production). Those dirs are created empty here
so the path isn't a surprise; the real `icon.png` / `adaptive-icon.png` are dropped
in during the Phase 11 human checklist.

Then:

1. Copy the theme tokens:
   `templates/theme/colors.ts` → `src/ui/theme/colors.ts`,
   `templates/theme/spacing.ts` → `src/ui/theme/spacing.ts`,
   `templates/theme/typography.ts` → `src/ui/theme/typography.ts`,
   `templates/theme/motion.ts` → `src/ui/theme/motion.ts`,
   `templates/theme/icons.ts` → `src/ui/theme/icons.ts`.
   They ship pre-filled with the house design language
   ([`../../DESIGN.md`](../../DESIGN.md)) — real values, not placeholders. Phase 7
   only changes them if the intake asked for a different brand.
2. Copy [`../../DESIGN.md`](../../DESIGN.md) → `docs/design-language.md`
   (`mkdir -p docs` first) **verbatim**. The kit is not on disk once this project
   is scaffolded, so without this copy the design rules — which the token files
   only carry values for — never reach the agents who build here. `CLAUDE.md`
   points at it for UI work; keep it out of the always-loaded context.
3. Copy the primitives:
   `templates/ui/button.tsx` → `src/ui/button.tsx`,
   `templates/ui/text.tsx` → `src/ui/text.tsx`,
   `templates/ui/text-input.tsx` → `src/ui/text-input.tsx`,
   `templates/ui/__tests__/button.test.tsx` → `src/ui/__tests__/button.test.tsx`.
4. Wire the starter home screen + its route (replaces the Phase 1 placeholder):
   `templates/features/home/screens/home-screen.tsx` →
   `src/features/home/screens/home-screen.tsx`, and
   `templates/app/index.tsx` → `app/index.tsx` (**overwrite** the placeholder).
   The route is thin — it just re-exports `HomeScreen`.
5. Drop a `README.md` into each of `src/ui`, `src/features`, `src/api`,
   `src/utilities`, `src/providers`, `src/constants`, `src/types`, and `assets`,
   generated from `templates/folder-README.md` (fill in the folder's purpose + a
   short "what's inside" list — seed it now, keep it updated as you add files).
   Every top-level `src/` directory carries one — `scripts/check-structure.sh`
   enforces it.
6. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` (drop the `.template`
   suffix). Fill in the project name + one-line description. This is the rulebook
   + repo map agents read first.

**Conventions reminder while you build:** no barrel files, kebab-case filenames
named after their export, co-located real-data `__tests__/`, a doc line on every
module/public symbol, no `any`, no `console.log`.

---

## Phase 4 — Environments (DEV / PROD / optional STAGING)

1. Copy `templates/app.config.ts` → `app.config.ts` and fill in name, slug,
   bundle id, package, scheme. **Derive the identifiers from the project name** —
   the intake doesn't collect them separately; only ask the user if they want
   something different. Let `<id>` be the project name with dashes removed:
   - display name (`<project-name>`) → the project name as given
   - slug (`<project-slug>`) → the project name (kebab-case, as given)
   - iOS bundle id + Android package (`<bundle-id>` / `<android-package>`) →
     `com.<id>.app` (the config appends `.test` for the dev/test variant itself)
   - URL scheme (`<url-scheme>`) → `<id>`

   It switches bundle id + display name on `APP_VARIANT`/`EAS_BUILD_PROFILE` (test
   vs prod) — keep that logic; delete `app.json` if `create-expo-app` left one
   (config now lives in `app.config.ts`).
2. Copy `templates/env.ts` → `src/constants/env.ts`. It validates `EXPO_PUBLIC_*`
   vars with a Zod schema. **Keep the static member-access pattern** —
   `babel-preset-expo` only inlines `process.env.EXPO_PUBLIC_X` at direct access
   sites, so production Hermes builds otherwise collapse every var to `undefined`.
   Add a new var by reading it via its full static `process.env.EXPO_PUBLIC_X`
   path and validating it inline.
3. Copy `templates/.env.example` → `.env.example`; create a local `.env` (and
   `.env.staging` if STAGING was requested). Ensure `.gitignore` ignores env
   files but keeps the example — add these two lines (in order):

   ```gitignore
   .env*
   !.env.example
   ```
4. **If STAGING was NOT requested**, remove the staging branches from `env.ts`
   (`'staging'` from the `AppEnv` union + `isAppEnv`) and the `staging` profile
   from `eas.json` (Phase 6) and `publish-update.yml` (Phase 6.5). **If it WAS**,
   keep them and add a matching `staging` build/update job where noted.

---

## Phase 5 — Root layout + providers

Edit `app/_layout.tsx` to mount the minimal provider stack (keep it small):

```tsx
// The named GestureHandlerRootView import already runs the library's side effects
// — no separate bare `import 'react-native-gesture-handler'` line is needed.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { colors } from '@/ui/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* The theme tokens are dark-band-first, so set the surface here —
              React Navigation's default card is white and the primitives' paper
              ink would be invisible on it. */}
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Add new app-wide providers to `src/providers/` and mount them here. One
`QueryClientProvider`, single source of truth.

---

## Phase 6 — Initialize EAS

```bash
eas login            # human step if not authenticated — prompt the user
eas init             # creates/links the EAS project, writes the projectId
eas build:configure  # generates a base eas.json
```

Replace the generated `eas.json` with `templates/eas.json` (keep `development` /
`production`; include `staging` only if requested). Fill in the iOS `appleTeamId`
/ `ascAppId` and Android tracks under `submit` — flag the parts that need the
user's Apple/Google account in the final checklist.

Copy the resolved `projectId` from `eas init` into `app.config.ts`
(`extra.eas.projectId` and the `updates.url`). If the EAS project lives under an
organization account, add `owner: '<expo-account>'` to `app.config.ts`.

---

## Phase 6.5 — CI/CD workflows

Two systems, cleanly split: **GitHub Actions** runs the cheap code-quality gate on
every PR; **EAS Workflows** run builds, OTA updates, and store submissions on EAS
infra.

```bash
mkdir -p .github/workflows .eas/workflows
```

| Source (in this kit) | Destination (in project) |
| --- | --- |
| `templates/.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| `templates/.github/workflows/code-review.yml` | `.github/workflows/code-review.yml` |
| `templates/.eas/workflows/development-build.yml` | `.eas/workflows/development-build.yml` |
| `templates/.eas/workflows/production-deploy.yml` | `.eas/workflows/production-deploy.yml` |
| `templates/.eas/workflows/publish-update.yml` | `.eas/workflows/publish-update.yml` |

- `ci.yml` runs type-check + lint + fmt:check + check:structure + knip + jscpd +
  test (the same checks as `bun run check`, each as its own named step). Keep its
  `bun-version` in sync with the `bun` field in `eas.json`.
- `code-review.yml` reviews every PR against this repo's own convention files,
  read from the **base** ref (so a PR cannot rewrite the rules it is judged by).
  It needs an `OPENROUTER_API_KEY` repository secret — that's on the human
  checklist. See [`../../CORE.md`](../../CORE.md) → "Quality gates & guardrails".
- `production-deploy.yml` needs the `submit.production` credentials in `eas.json`
  filled in.
- If **STAGING was not requested**, drop the `staging` option from
  `publish-update.yml`'s channel list. If it **was**, add matching `staging`
  build/update jobs (mirror `development` with `profile: staging`).

Validate locally with `eas workflow:validate` (or commit and let EAS lint them).

---

## Phase 7 — Design pass (wire the fonts, then apply the intake context)

Read [`../../DESIGN.md`](../../DESIGN.md) — the house design language. The theme
tokens copied in Phase 3 already implement it, so the app starts on-language.

**7.1 Load the fonts (always — the tokens name them).** The type scale references
`Archivo-*` / `JetBrainsMono-*` family keys; until the files ship, RN silently
falls back to the system face.

```bash
bunx expo install expo-font
```

Vendor the **static** Archivo + JetBrains Mono `.ttf` files (SIL Open Font
License). They must be static: a variable `Archivo[wdth,wght].ttf` exposes a
single family key, so the `Archivo-Medium` / `Archivo-SemiBold` keys in
`typography.ts` would resolve to nothing.

The `@expo-google-fonts/*` packages ship the static faces, but under
weight-suffixed filenames (`Archivo_400Regular.ttf`) whose PostScript name is
still `Archivo-Regular` — that filename/PostScript split is exactly the
render-on-one-platform-only bug flagged below. **Rename on copy** so both sides
agree:

```bash
bun add -d @expo-google-fonts/archivo @expo-google-fonts/jetbrains-mono
mkdir -p assets/fonts
find node_modules/@expo-google-fonts/archivo -name 'Archivo_400Regular.ttf' \
  -exec cp {} assets/fonts/Archivo-Regular.ttf \;
find node_modules/@expo-google-fonts/archivo -name 'Archivo_500Medium.ttf' \
  -exec cp {} assets/fonts/Archivo-Medium.ttf \;
find node_modules/@expo-google-fonts/archivo -name 'Archivo_600SemiBold.ttf' \
  -exec cp {} assets/fonts/Archivo-SemiBold.ttf \;
find node_modules/@expo-google-fonts/jetbrains-mono -name 'JetBrainsMono_400Regular.ttf' \
  -exec cp {} assets/fonts/JetBrainsMono-Regular.ttf \;
find node_modules/@expo-google-fonts/jetbrains-mono -name 'JetBrainsMono_500Medium.ttf' \
  -exec cp {} assets/fonts/JetBrainsMono-Medium.ttf \;
```

Confirm five files landed in `assets/fonts/` before continuing — `find` prints
nothing when a package reorganises its layout, and a silently-empty copy ships an
app on the system font.

Then register them in `app.config.ts` via the `expo-font` config plugin so they
are embedded at build time. **Extend the existing `plugins` array — do not
replace it**; dropping `'expo-router'` breaks every route:

```ts
plugins: [
  'expo-router', // keep — the router plugin already in app.config.ts
  [
    'expo-font',
    {
      fonts: [
        './assets/fonts/Archivo-Regular.ttf',
        './assets/fonts/Archivo-Medium.ttf',
        './assets/fonts/Archivo-SemiBold.ttf',
        './assets/fonts/JetBrainsMono-Regular.ttf',
        './assets/fonts/JetBrainsMono-Medium.ttf',
      ],
    },
  ],
],
```

The family key RN resolves is the filename stem on Android and the font's
PostScript name on iOS — the rename above makes them identical, so keep the names
in `src/ui/theme/typography.ts`, the filenames, and the PostScript names in
lockstep. If a face renders as the system font on one platform only, that's the
mismatch.

**The config plugin embeds fonts at native build time — Expo Go will never show
them.** After editing `app.config.ts`, regenerate the native projects and run a
dev build; otherwise every face silently stays the system fallback and Phase 10
goes green on a design that was never applied:

```bash
bunx expo prebuild --clean
bunx expo run:ios     # or: bunx expo run:android
```

**7.2 Apply the intake design context.**

1. If the intake named one of the four house signal temperatures (Jade,
   Blueprint, Ion, Chalk), change `defaultSignal` in `src/ui/theme/colors.ts` and
   stop. That is the whole theming surface — nothing else in the file moves.
2. If the intake described a **different** brand, replace the values in
   `src/ui/theme/colors.ts` / `typography.ts` — but keep the *structure*:
   alternating bands (`colors` + `colorsLight`), one signal with four steps,
   fixed status colours, the mono meta layer, hairline depth. The signal never
   fills a button.
3. If it did neither, keep the house tokens as shipped and say so in the design
   notes.
4. Refine the baseline primitives (`button.tsx`, `text.tsx`, `text-input.tsx`)
   only if the direction calls for it — keep them token-driven.
   **Band note:** the shipped primitives import `colors` (the dark band)
   statically, so they are single-band as delivered. If the app alternates bands,
   add a `src/providers/theme-provider.tsx` that exposes `colors | colorsLight`
   through context and switch the primitives to read it via a hook — do that
   *before* building screens, not after.
5. Icons need a renderer: `bunx expo install react-native-svg`, then one
   `src/ui/icon.tsx` wrapper over `theme/icons.ts` that owns the stroke width,
   square caps and mitred joins so no mark can drift from the construction rules.
6. Record the direction in the `## Design notes` section of `CLAUDE.md` (audience,
   tone, palette/type rationale, and any deviation from `DESIGN.md`) so future
   agents inherit the "why".

> Optional: if the `/impeccable` or `/design` skill is installed, use it to
> generate a fuller design spec (`docs/design.md`) and refine the tokens — it's a
> helper, not a requirement. Map its web/CSS "tokens" to the `src/ui/theme/*`
> files and "components" to RN `StyleSheet` primitives.

---

## Phase 8 — Optional integrations (only what the intake selected)

Skip any the user declined. Add a README line under the relevant folder for each.

**8a. API layer** — two paths, same as the console stack.

**Our own API → oRPC.** `bun add @orpc/client @orpc/tanstack-query`, then copy
`../console/templates/src/api/orpc.ts` → `src/api/orpc.ts` and point its
type-only `AppRouter` import at wherever the API's router type comes from. Query
keys derive from the procedure path — never hand-write a `queryKey` array for an
oRPC call.

**Everything else → the kit's fetch client.** No HTTP dependency to install: copy
`../console/templates/utilities/http.ts` → `src/utilities/http.ts` (**not axios**; it is written to run on Hermes, using a manual
`AbortController` rather than `AbortSignal.timeout`/`any`, which Hermes lacks).
Then create `src/api/http-client.ts` (one `createHttpClient` instance reading the
base URL and timeout from `@/constants/env`) and a sample `clients/` + `queries/`
pair per [`STRUCTURE.md`](./STRUCTURE.md). A response is `unknown` until you pass
a `parse` guard — that is the point, not friction to route around. Default to
hand-written clients/queries; only weigh `orval` codegen if the backend ships a
reliable OpenAPI spec that changes frequently (see LIBRARIES.md "Use with
caution").

**8b. Auth (better-auth)** — `bun add better-auth` and
`bunx expo install expo-secure-store`. The app holds the **client** half only:
create the auth client with `createAuthClient` (better-auth's Expo plugin, with
the session stored in secure storage), expose it through a provider in
`src/providers/`, point the `http` client's `headers` hook at the session token,
and gate routes with an `(auth)` route group. The server half — `betterAuth(...)`,
the tables, `/api/auth/*` — belongs to the `backend-ts` service; no auth secret
ever ships in the app bundle. Check better-auth's current Expo docs for the
plugin's exact setup.

**8c. Local storage** — `bunx expo install @react-native-async-storage/async-storage`;
create `src/utilities/storage.ts` exposing a typed wrapper + centralized key
constants. (For synchronous perf-critical storage, weigh `react-native-mmkv` per
LIBRARIES.md "Use with caution".)

For any product integration (Sentry, analytics, push, chat), follow LIBRARIES.md
and add it as its own provider/module — never as a default.

---

## Phase 9 — Top-level README

Copy `templates/README.md` → `README.md` and fill in: project description, the
env/build matrix, the per-directory content breakdown, and how to run/test/build.
Cross-link `CLAUDE.md` (the design direction lives in its **Design notes**
section).

---

## Phase 10 — Verify (gate must be green)

Run the full gate and fix anything red. Normalize formatting first, then gate:

```bash
bun run fmt          # auto-format so fmt:check is clean
bun run check        # tsc --noEmit + oxlint --deny-warnings + oxfmt --check + jest
bunx expo start      # app boots in Expo Go / dev client
```

If Phase 7.1 registered the fonts, verify in a **dev build** (`bunx expo run:ios`
/ `run:android`), not Expo Go — the config plugin only embeds faces during a
native build, so Expo Go renders the system fallback and tells you nothing.

`bun run check` must exit 0 — the sample `button.test.tsx` must pass. Report the
results honestly; do not mark setup complete with any part of `bun run check`
failing, even an unrelated one.

---

## Phase 11 — Human-only checklist (print this for the user)

End by printing the checklist of what only a human can do. Tailor it to the chosen
options; the common items:

- [ ] `eas login` and confirm the EAS project (`eas init`) under the right account.
- [ ] Apple Developer: register the bundle id(s), create the App Store Connect
      app, and supply `appleTeamId` / `ascAppId` for `eas.json` submit profiles.
- [ ] Google Play: create the app + service account; confirm the Android package.
- [ ] Add per-profile secrets to EAS env (`eas env:create`) for any API keys /
      base URLs / integration tokens used by the selected integrations.
- [ ] Provide final **app icons & splash** assets — drop `icon.png` +
      `adaptive-icon.png` into `assets/icons/dev/` and `assets/icons/prod/` (the
      dirs `app.config.ts` points at, seeded empty with `.gitkeep`); confirm the
      dev vs prod icon variants.
- [ ] Set up the OTA `updates.url` channel→branch mapping in EAS (`eas channel`)
      so `publish-update.yml` ships to the right audience.
- [ ] Create the GitHub repo, add the `OPENROUTER_API_KEY` secret for the
      code-review workflow, and set branch protection to require both the **CI**
      check (`.github/workflows/ci.yml`) and a passing **Code Review** on PRs to
      `main`.
- [ ] Confirm the **EAS Workflows** appear in the EAS dashboard and that the
      `production-deploy.yml` submit credentials (Apple / Google) are valid.
- [ ] Fill in real values in `.env` / EAS env for each `EXPO_PUBLIC_*` var.

> Once these are done, the app is ready for `eas build --profile development`.
