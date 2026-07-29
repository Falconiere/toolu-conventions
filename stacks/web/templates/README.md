# {{APP_NAME}}

{{ONE_PARAGRAPH_DESCRIPTION}} — a Next.js web app built with the App Router and
TypeScript.

> **New here (human or agent)?** Read [`CLAUDE.md`](./CLAUDE.md) first — it's the
> repo map + conventions. This README is the orientation + run/build guide.

## Quick start

```bash
bun install          # install deps
bun run dev          # start the dev server (http://localhost:3000)
bun run build        # production build
bun run start        # serve the production build
```

## Project layout

| Path | What |
| --- | --- |
| `src/app/` | App Router routes (thin — each re-exports a feature screen). |
| `src/ui/` | Design-system primitives + `theme/` tokens (colors, spacing, typography, motion, icons). |
| `src/features/` | Feature modules — one folder each (`screens/`, `components/`, `hooks/`, …). |
| `src/api/` | Data layer: `clients/` (requests) + `queries/` (React Query hooks). |
| `src/utilities/` | Shared pure helpers. |
| `src/providers/` | App-level context providers (client components, mounted in `src/app/layout.tsx`). |
| `src/constants/` | `env.ts` (hand-validated env) + enums. |
| `src/types/` | Cross-cutting types. |
| `docs/` | `design-language.md` — the house UI rules. Read before any UI work. |
| `.github/workflows/` | GitHub Actions — CI gate (type-check, lint, format, test). |

Every `src/*` folder has a `README.md` describing its contents.

## Environments

| Env | When |
| --- | --- |
| development | local (`bun run dev`) |
{{STAGING_ROW}}
| production | deployed release |

Public config is read from `NEXT_PUBLIC_*` env vars and validated in
`src/constants/env.ts`. Server-only secrets are read without the prefix and never
reach the browser. Copy `.env.example` → `.env.local` and fill it in.

## Scripts

| Script | Does |
| --- | --- |
| `bun run check` | Full gate: type-check + lint + format-check + test. |
| `bun run type-check` | `tsc --noEmit` (strict). |
| `bun run lint` / `lint:fix` | oxlint. |
| `bun run fmt` / `fmt:check` | oxfmt. |
| `bun run test` / `test:watch` | Vitest (unit/component). |

## CI

**GitHub Actions** (`.github/workflows/ci.yml`) runs type-check + lint +
format-check + test on every PR and push to `main` — the same checks as
`bun run check`.

## Conventions

Strict TypeScript, no barrel files, kebab-case filenames, co-located tests, thin
routes, Server Components by default (`'use client'` only when needed), React
Query for server state. Full rules in [`CLAUDE.md`](./CLAUDE.md).
