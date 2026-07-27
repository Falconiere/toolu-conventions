# <project-name>

<one-paragraph-description> — a React Native app built with Expo, Expo Router,
and TypeScript.

> **New here (human or agent)?** Read [`CLAUDE.md`](./CLAUDE.md) first — it's the
> repo map + conventions. This README is the orientation + run/build guide.

## Quick start

```bash
bun install          # install deps
bun run start        # start the Expo dev server
bun run ios          # build + run on iOS (dev client)
bun run android      # build + run on Android (dev client)
```

## Project layout

| Path | What |
| --- | --- |
| `app/` | Expo Router routes (thin — each re-exports a feature screen). |
| `src/ui/` | Design-system primitives (`button`, `text`, `text-input`) + `theme/` tokens (colors, spacing, typography, motion). |
| `src/features/` | Feature modules — one folder each (`screens/`, `components/`, `hooks/`, …). |
| `src/api/` | Data layer: `clients/` (requests) + `queries/` (React Query hooks). |
| `src/utilities/` | Shared pure helpers. |
| `src/providers/` | App-level context providers (mounted in `app/_layout.tsx`). |
| `src/constants/` | `env.ts` (hand-validated env) + enums. |
| `src/types/` | Cross-cutting types. |
| `assets/` | Images, icons, fonts. |
| `.github/workflows/` | GitHub Actions — CI gate (type-check, lint, format, test). |
| `.eas/workflows/` | EAS Workflows — builds, OTA updates, store submissions. |

Every `src/*` folder has a `README.md` describing its contents.

## Environments

| Env | When | Bundle id |
| --- | --- | --- |
| development | local + dev builds | `<bundle-id>.test` |
| production | store releases | `<bundle-id>` |

(Add a `staging` row if a staging env was enabled at setup.)

Config lives in `app.config.ts` (variant-driven) and `src/constants/env.ts`
(hand-validated `EXPO_PUBLIC_*`). Copy `.env.example` → `.env` and fill it in.

## Scripts

| Script | Does |
| --- | --- |
| `bun run check` | Full gate: type-check + lint + format-check + test. |
| `bun run type-check` | `tsc --noEmit` (strict). |
| `bun run lint` / `lint:fix` | oxlint. |
| `bun run fmt` / `fmt:check` | oxfmt. |
| `bun run test` | Jest (unit/component). |

## Builds (EAS)

```bash
eas build --profile development   # internal dev build
eas build --profile production    # store build
```

Profiles are defined in `eas.json`. The design direction captured during setup
lives in the **Design notes** section of [`CLAUDE.md`](./CLAUDE.md).

## CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`) — runs type-check + lint +
  format-check + test on every PR and push to `main` (same checks as
  `bun run check`).
- **EAS Workflows** (`.eas/workflows/`) — `development-build` (on-demand dev
  clients), `production-deploy` (build + submit, on a `v*` tag), and
  `publish-update` (manual OTA to a channel). Run with `eas workflow:run <file>`
  or from the EAS dashboard.

## Conventions

Strict TypeScript, no barrel files, kebab-case filenames, co-located real-data
tests, `StyleSheet` + theme tokens (no styling library), React Query for server
state. Full rules in [`CLAUDE.md`](./CLAUDE.md).
