# Project Structure & Conventions

The canonical layout every new web app in this kit produces. It inherits every
rule in [`../../CORE.md`](../../CORE.md) and adds the web-specific rules below —
it never relaxes a CORE rule. Designed for **clean feature iteration** and **easy
LLM traversal**: predictable folder names, a README in every top-level source
folder, no barrel files (every import points at the file that holds the thing),
and thin route files.

## Folder tree

```
<app>/
├── src/
│   ├── app/                  # Next.js App Router — ROUTES ONLY (thin, see "Routes")
│   │   ├── layout.tsx        # Root layout: <html>/<body> + mounts providers
│   │   ├── page.tsx          # Re-exports a feature screen
│   │   ├── (marketing)/      # Route group → shared layout, no URL segment
│   │   └── api/              # Route handlers (route.ts) — server only
│   ├── ui/                   # Design system — primitives + theme. README.md
│   │   └── theme/            # colors.ts · spacing.ts · typography.ts · motion.ts · icons.ts (plain TS tokens)
│   ├── features/             # One folder per feature. README.md
│   │   └── <feature>/
│   │       ├── screens/      # <name>-screen.tsx (rendered by src/app/ routes)
│   │       ├── components/   # feature-local components
│   │       ├── hooks/        # feature-local hooks
│   │       ├── api/          # feature-local clients/queries (optional)
│   │       ├── types.ts
│   │       └── __tests__/
│   ├── api/                  # Cross-feature data layer. README.md
│   │   ├── clients/          # one file per resource — request fns (CRUD)
│   │   └── queries/          # React Query hooks + key factories, per domain
│   ├── utilities/            # Shared pure helpers (dates, formatters, …). README.md
│   ├── providers/            # App-level context providers ('use client'). README.md
│   ├── constants/            # env.ts (hand-validated), enums
│   └── types/                # cross-cutting TS types
├── public/                   # static assets served at the site root
├── docs/                     # design-language.md — house UI rules, read before UI work
├── scripts/                  # check-structure.sh — folder-tree half of the gate
├── next.config.ts            # Next.js config
├── tsconfig.json             # strict + `@/*` path alias
├── vitest.config.ts · vitest.setup.ts
├── .oxlintrc.json · .oxfmtrc.json · lefthook.yml
├── .env.example
├── .github/workflows/        # GitHub Actions — CI gate (type-check/lint/fmt/test)
├── CLAUDE.md                 # agent rules + repo map (read first)
└── README.md                 # human + agent entry point
```

> Folder vocabulary (`ui`, `utilities`, `api`, `features`, `providers`) is
> intentional and shared across the stacks in this kit. Keep it.

## Path aliases

Configured in `tsconfig.json` (`paths`) and resolved in tests by
`vite-tsconfig-paths`. Always import via the alias — never deep relative paths
like `../../../ui`.

| Alias | Resolves to | Example import |
| --- | --- | --- |
| `@/*` | `src/*` | `import { colors } from '@/ui/theme/colors'` |
| `@/ui/*` | `src/ui/*` | `import { Button } from '@/ui/button'` |
| `@/features/*` | `src/features/*` | `import { HomeScreen } from '@/features/home/screens/home-screen'` |
| `@/api/*` | `src/api/*` | `import { fetchShifts } from '@/api/clients/shifts'` |
| `@/utilities/*` | `src/utilities/*` | `import { formatMoney } from '@/utilities/format-money'` |
| `@/providers/*` | `src/providers/*` | `import { AppProviders } from '@/providers/app-providers'` |
| `@/constants/*` | `src/constants/*` | `import { APP_ENV } from '@/constants/env'` |
| `@/types/*` | `src/types/*` | `import type { Shift } from '@/types/shift'` |

One base mapping (`@/*` → `src/*`) covers them all; the sub-namespaces above are
the conventional shape, not separate config entries. Deep relative imports
(`../../…`) are a lint error (`no-restricted-imports`); use the alias.

## Hard conventions (web — added on top of CORE)

These extend the CORE rules and are **machine-enforced** by `.oxlintrc.json` and
`scripts/check-structure.sh` (both run by `bun run check`; Lefthook runs the
lint/format subset on staged files). Each convention below names its enforcer.
See [`templates/CLAUDE.md.template`](./templates/CLAUDE.md.template) for the full
blocked-patterns list.

1. **`src/app/` is routes only, and thin.** Files under `src/app/` map URL →
   screen and configure the route. No data fetching, state, or business logic in
   a route file. (See "Routes".)
   _Enforced by:_ `no-restricted-imports` (only `src/app/` may import
   `@/features/*`, so feature logic can't leak into other layers) + review.
2. **`src/app/` is the only place default exports are allowed.** Next.js requires
   default exports for `page` / `layout` / `route` / `error` / `loading` /
   `not-found` / `template`. Everywhere else uses **named exports**. These route
   files are also the **sole sanctioned exception to the no-barrel rule** (CORE
   rule 1): a thin route re-exports its feature screen (`export default
   HomeScreen`) — the one re-export the kit allows.
   _Enforced by:_ `import/no-default-export` (off only under `src/app/`),
   `no-restricted-imports` barrel-group, and `check-structure.sh` (no
   `index.ts`/`index.tsx` outside `src/app/`).
3. **Server vs. Client Component discipline.** Components are **Server Components
   by default**. Add the `'use client'` directive only when a file genuinely
   needs interactivity, React state/effects, or browser-only APIs. Push the
   boundary as low in the tree as possible — a whole page shouldn't become a
   Client Component because one leaf button needs an `onClick`. Providers and
   interactive widgets are client; layouts, static content, and server data
   fetching stay server.
   _Enforced by:_ not lint-checkable — code review.
4. **Filename ↔ content.** Kebab-case filenames named after what they export
   (`shift-card.tsx` → `ShiftCard`, `use-shifts.ts` → `useShifts`). One primary
   export per file. Next's reserved route filenames (`page`, `layout`, `route`,
   …) are the sanctioned exception and live only under `src/app/`.
   _Enforced by:_ `unicorn/filename-case` (kebab-case; off under `src/app/`
   where Next owns the naming).
5. **Co-locate tests** in a sibling `__tests__/` folder (`button.tsx` →
   `__tests__/button.test.tsx`), and test with **real data** — exercise real
   inputs and real integration paths. A mock-only test that just proves a mock
   returns what it was told is banned; it hides integration breakage (CORE
   rule 6).
   _Enforced by:_ `check-structure.sh` (no centralized test dirs; every
   `*.test.ts(x)` must sit in a sibling `__tests__/`) + the Vitest `include`
   pattern; real-data rule by review.
6. **No `any`**, **no `console.log` / `debugger`**, **`max-lines: 300`** per file
   (code lines; tests exempt) — the CORE rules.
   _Enforced by:_ `typescript/no-explicit-any`, `no-console`, `no-debugger`, and
   `max-lines` (`skipBlankLines` + `skipComments`, off for tests).
7. **Flat until it grows.** Keep a component/util as a single file until it passes
   ~300 lines or sprouts sub-parts, then promote it to a folder
   (`button/` with `button.tsx` + `button.module.css`).
   _Enforced by:_ `max-lines` forces the split; folder shape by review.

## Style baseline (UI defaults)

Default UI manners for every screen and primitive. They aren't all
lint-enforceable, so they live here as the agreed baseline — deviate only when
the design explicitly calls for it, and say so in a comment.

1. **Tokens, not literals.** Colors, spacing, radii, and type come from
   `src/ui/theme/*` — no hardcoded hex, no magic numbers. Prefer CSS Modules or
   plain CSS that references the token values over inline `style` objects.
2. **Compose the primitives.** Build screens from the `src/ui/*` primitives so
   typography, color, and interactive states stay consistent.
3. **Accessible by default.** Semantic HTML first; interactive elements are
   real `<button>` / `<a>` with labels; images carry `alt`; forms have labels.
   The `jsx-a11y` plugin flags the common misses.
4. **Next primitives over raw ones.** Use `next/link` for internal navigation
   and `next/image` for images (sizing + optimization) rather than raw `<a>` /
   `<img>` for app content.

## Routes (App Router)

Route files are a thin mapping from URL → screen. Example `src/app/page.tsx`:

```tsx
import { HomeScreen } from '@/features/home/screens/home-screen';

export default HomeScreen;
```

The root `src/app/layout.tsx` owns `<html>`/`<body>` and mounts the app-wide
providers (a client component from `src/providers/`):

```tsx
import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

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

`src/app/**` is the **only** place default exports are allowed (Next.js requires
them). Everywhere else uses named exports.

## The `api/` data layer pattern

Two tiers — request functions, then the React Query hooks that consume them.
This keeps transport separate from caching. Scaffolded only if you opt into the
API layer during setup; the baseline is backend-agnostic.

**`src/api/clients/shifts.ts`** — pure request functions (no React):

```ts
import { httpClient } from '@/api/http-client';
import type { Shift } from '@/types/shift';

export function fetchShifts(locationId: string): Promise<Shift[]> {
  return httpClient.get<Shift[]>(`/locations/${locationId}/shifts`).then((r) => r.data);
}
```

**`src/api/queries/shifts/query-keys.ts`** — a key factory for granular cache
invalidation:

```ts
export const shiftKeys = {
  all: ['shifts'] as const,
  lists: () => [...shiftKeys.all, 'list'] as const,
  list: (locationId: string) => [...shiftKeys.lists(), locationId] as const,
};
```

**`src/api/queries/shifts/use-shifts.ts`** — the hook (client-side):

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchShifts } from '@/api/clients/shifts';
import { shiftKeys } from '@/api/queries/shifts/query-keys';

export function useShifts(locationId: string) {
  return useQuery({
    queryKey: shiftKeys.list(locationId),
    queryFn: () => fetchShifts(locationId),
  });
}
```

> For data that can be fetched on the server, prefer fetching directly in a
> Server Component (or a server action) — React Query is for client-side caching
> of interactive/refetched data, not a default wrapper around every request.

## LLM-indexability strategy

An agent should answer "where does X live / is there a util for Y already?"
without reading the whole tree. We get that from:

- **A README in every top-level source folder** (`src/ui`, `src/features`,
  `src/api`, `src/utilities`, `src/providers`). Each lists what belongs there,
  what's currently inside (one line each), and where NOT to put things. Use
  [`templates/folder-README.md`](./templates/folder-README.md).
- **`CLAUDE.md` at the root** as the map + rulebook, read first by agents.
- **No barrels + filename ↔ content** means grep for a symbol lands on its
  definition immediately.
- **The `@/` path alias** makes import sites self-describing
  (`@/utilities/format-money` tells you exactly where it is).

When you add a notable util/primitive/feature, add a one-line entry to that
folder's README so the index stays current.
