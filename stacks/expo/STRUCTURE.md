# Structure & Conventions — Expo

The canonical layout every new app in this stack produces. It inherits every rule
in [`../../CORE.md`](../../CORE.md) and adds the Expo-specific ones below; a rule
here may tighten a CORE rule but never relaxes one. The layout is designed for
**clean feature iteration** and **easy agent traversal**: predictable folder
names, a README in every top-level source directory, no barrel files (every
import points at the file that holds the thing), and thin route files.

## Folder tree

```
<app>/
├── app/                      # Expo Router — ROUTES ONLY (thin, see "Routes" below)
│   ├── _layout.tsx           # Root layout: mounts providers + <Stack>
│   ├── (tabs)/               # Route group → tab navigator (_layout.tsx)
│   └── ...                   # Each route re-exports a feature screen
├── src/
│   ├── ui/                   # Design system — primitives + theme. README.md
│   │   ├── theme/            # colors.ts · spacing.ts · typography.ts · motion.ts · icons.ts (plain TS tokens)
│   │   ├── button.tsx        # Primitive: variants + sizes
│   │   ├── text.tsx          # Primitive: typographic variants
│   │   ├── text-input.tsx    # Primitive: labeled input + error state
│   │   └── __tests__/
│   ├── features/             # One folder per feature. README.md
│   │   └── <feature>/
│   │       ├── screens/      # <name>-screen.tsx (rendered by app/ routes)
│   │       ├── components/   # feature-local components
│   │       ├── hooks/        # feature-local hooks
│   │       ├── api/          # feature-local clients/queries (optional)
│   │       ├── types.ts
│   │       └── __tests__/
│   ├── api/                  # Cross-feature data layer. README.md
│   │   ├── clients/          # one file per resource — request fns (CRUD)
│   │   └── queries/          # React Query hooks + key factories, per domain
│   ├── utilities/            # Shared pure helpers (dates, formatters, …). README.md
│   ├── providers/            # App-level context providers. README.md
│   ├── constants/            # env.ts (Zod-validated), enums
│   └── types/                # cross-cutting TS types
├── assets/                   # images, icons, fonts, animations. README.md
├── docs/                     # design-language.md — house UI rules, read before UI work
├── app.config.ts             # variant-aware Expo config (DEV/STAGING/PROD)
├── eas.json                  # EAS build/submit profiles
├── .eas/workflows/           # EAS Workflows — builds, OTA updates, store submits
├── .github/workflows/        # GitHub Actions — CI gate (type-check/lint/fmt/test)
├── tsconfig.json             # strict + path aliases
├── jest.config.js · jest.setup.ts
├── .oxlintrc.json · .oxfmtrc.json · lefthook.yml
├── .env.example
├── CLAUDE.md                 # agent rules + repo map (read first)
└── README.md                 # human + agent entry point
```

> The folder vocabulary (`assets`, `ui`, `utilities`, `api`) is intentional and
> stable — keep it so every repo in this stack reads the same way.

## Path aliases

Configured in `tsconfig.json` and read by Babel (`babel-preset-expo` reads
tsconfig paths). Always import via alias — never deep relative paths like
`../../../ui`.

```ts
@/ui/*          → src/ui/*
@/features/*    → src/features/*
@/api/*         → src/api/*
@/utilities/*   → src/utilities/*
@/providers/*   → src/providers/*
@/constants/*   → src/constants/*
@/types/*       → src/types/*
@/assets/*      → assets/*
```

## Hard conventions

These are **machine-enforced** — the gate (`bun run check`) fails on a violation,
not just review. See [`templates/CLAUDE.md.template`](./templates/CLAUDE.md.template)
for the full "blocked patterns" list. What enforces what:

- **No barrel imports / no deep relatives / feature isolation** — oxlint
  `no-restricted-imports` (bans `**/index*`, `../../*`, and `@/features/*` outside
  `app/**`).
- **No barrel *files*, allowed `src/` dirs, per-folder READMEs, `lefthook.yml` not
  `.yaml`, test colocation** — `scripts/guardrails/run.sh` (walks the tree the
  linter can't see). Tests must sit in a sibling `__tests__/`; a centralized test
  dir (`src/__tests__`, `src/tests`, root `tests`/`test`) or any `*.test.*` under
  `src/` outside a `__tests__/` fails the gate.
- **Kebab-case filenames** — oxlint `unicorn/filename-case` (off in `app/**`; the
  router owns `_layout`, `+html`, `(tabs)` naming).
- **300-line ceiling** — oxlint `max-lines` (code lines only, tests exempt).
- **No `any`, no `console.log`/`debugger`, default exports only in `app/**`** —
  oxlint rules + Lefthook pre-commit.

1. **No barrel files.** Never create an `index.ts(x)` that only re-exports. Import
   the concrete file: `import { Button } from '@/ui/button'`. This keeps every
   symbol traceable to exactly one file — the single most useful property for an
   agent navigating the repo. **The one sanctioned exception is `app/**` route
   files** — they re-export a feature screen as a default export because Expo
   Router requires it (see rule 2 and "Routes"). Nowhere else.
2. **Thin routes.** Files under `app/` only re-export a feature screen and
   configure navigation. No logic, data fetching, or state. (See "Routes".)
3. **Filename ↔ content.** Kebab-case filenames; the file is named after what it
   exports (`shift-card.tsx` → `ShiftCard`, `use-shifts.ts` → `useShifts`). One
   primary export per file.
4. **Co-locate tests** in a sibling `__tests__/` folder: `button.tsx` →
   `__tests__/button.test.tsx`. Tests use real data — no mock-data-only tests.
5. **No `any`.** No `as any`, `: any`, or `as unknown as T`. Use `unknown` + type
   guards. (`typescript/no-explicit-any: error`.)
6. **No `console.log` / `debugger`.** Use `console.warn` / `console.error`.
7. **Flat until it grows.** Keep a primitive/util as a single file until it
   passes ~300 lines or sprouts sub-parts, then promote it to a folder
   (`button/` with `button.tsx` + `styles.ts`).
8. **`max-lines: 300`** per file (tests exempt).

## Style baseline (UI defaults)

These are the default UI manners every screen and primitive follows. They aren't
all lint-enforceable, so they live here as the agreed baseline — deviate only
when the design explicitly calls for it, and say so in a comment.

1. **Hide scroll indicators by default.** Every scrollable
   (`ScrollView`, `FlatList`, `SectionList`) sets
   `showsVerticalScrollIndicator={false}` and
   `showsHorizontalScrollIndicator={false}`. A visible scrollbar is opt-in for the
   rare case the design wants one — not the default.
   ```tsx
   <ScrollView
     showsVerticalScrollIndicator={false}
     showsHorizontalScrollIndicator={false}
   >
   ```
2. **Tokens, not literals.** Colors, spacing, radii, and type come from
   `src/ui/theme/*` — no hardcoded hex, no magic numbers in styles. Static styles
   go through `StyleSheet.create`, never inline object literals in `render`.
3. **Compose the primitives.** Use `@/ui/text`, `@/ui/button`, `@/ui/text-input`
   instead of raw `<Text>` / `<Pressable>` / `<TextInput>` so typography, color,
   and pressed/disabled/error states stay consistent.
4. **Respect safe areas.** Use `react-native-safe-area-context`
   (`useSafeAreaInsets` / `SafeAreaView`); never hardcode status-bar or notch
   padding.
5. **Touchable + accessible.** Interactive elements are ≥ 44×44pt and carry an
   `accessibilityRole` and label. (The `Button` primitive already does this.)
6. **Right list for the job.** Long or variable-length lists use
   `FlatList`/`SectionList` (virtualized); reserve `ScrollView` for short, finite
   content. For inputs inside a scroll view, set
   `keyboardShouldPersistTaps="handled"`.

## Routes (Expo Router)

Route files are a thin mapping from URL → screen. Example `app/(tabs)/index.tsx`:

```tsx
import { HomeScreen } from '@/features/home/screens/home-screen';

export default HomeScreen;
```

`app/**` is the **only** place default exports are allowed (Expo Router requires
them). Everywhere else uses named exports.

## The `api/` data layer pattern

Two tiers — request functions, then the React Query hooks that consume them. This
keeps transport separate from caching.

**`src/api/clients/posts.ts`** — pure request functions (no React):

```ts
import { httpClient } from '@/api/http-client';
import type { Post } from '@/types/post';

export function fetchPosts(authorId: string): Promise<Post[]> {
  return httpClient.get(`/authors/${authorId}/posts`).then((r) => r.data);
}
```

**`src/api/queries/posts/query-keys.ts`** — a key factory for granular cache
invalidation:

```ts
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (authorId: string) => [...postKeys.lists(), authorId] as const,
};
```

**`src/api/queries/posts/use-posts.ts`** — the hook:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '@/api/clients/posts';
import { postKeys } from '@/api/queries/posts/query-keys';

export function usePosts(authorId: string) {
  return useQuery({
    queryKey: postKeys.list(authorId),
    queryFn: () => fetchPosts(authorId),
  });
}
```

> The `api/` layer (and its `http-client` + `ApiError`) is scaffolded only if you
> opt into an API client during setup — the baseline is backend-agnostic.

## Agent-indexability strategy

An agent should be able to answer "where does X live / is there a util for Y
already?" without reading the whole tree. We get that from:

- **A README in every top-level source folder** (`src/ui`, `src/features`,
  `src/api`, `src/utilities`, `src/providers`, `assets`). Each lists what belongs
  there, what's currently inside (one line each), and where NOT to put things.
  Use [`templates/folder-README.md`](./templates/folder-README.md).
- **`CLAUDE.md` at the root** acts as the map + rulebook, read first by agents.
- **No barrels + filename ↔ content** means grep for a symbol lands on its
  definition immediately.
- **Path aliases** make import sites self-describing (`@/utilities/format-money`
  tells you exactly where it is).

When you add a notable util/primitive/feature, add a one-line entry to that
folder's README so the index stays current.
