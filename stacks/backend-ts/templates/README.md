# {{APP_NAME}}

{{ONE_PARAGRAPH_DESCRIPTION}} — a Bun + Hono HTTP service written in strict
TypeScript.

> **New here (human or agent)?** Read [`CLAUDE.md`](./CLAUDE.md) first — it's the
> repo map + conventions. This README is the orientation + run guide.

## Quick start

```bash
bun install          # install deps
bun run dev          # start the server with hot reload (http://localhost:3000)
curl localhost:3000/health   # → {"status":"ok"}
```

## Project layout

| Path                 | What                                                           |
| -------------------- | -------------------------------------------------------------- |
| `src/app.ts`         | The Hono app — routes + middleware mounted here (wiring only). |
| `src/index.ts`       | Server entry — `Bun.serve(app.fetch)` on the validated `PORT`. |
| `src/routes/`        | One module per resource — thin HTTP handlers, no logic.        |
| `src/services/`      | Business logic — framework-agnostic, unit-testable.            |
| `src/utilities/`     | Shared pure helpers.                                           |
| `src/constants/`     | `env.ts` (hand-validated env) + enums.                         |
| `src/types/`         | Cross-cutting types.                                           |
| `.github/workflows/` | GitHub Actions — CI gate (type-check, lint, format, test).     |

Every `src/*` folder has a `README.md` describing its contents.

## Environments

Config lives in `src/constants/env.ts`, which hand-validates the process env at
startup. Bun loads `.env` natively — copy `.env.example` → `.env` and fill it in.

| Var       | Purpose                                    | Default       |
| --------- | ------------------------------------------ | ------------- |
| `APP_ENV` | `development` \| `staging` \| `production` | `development` |
| `PORT`    | Port the server listens on                 | `3000`        |

## Scripts

| Script                      | Does                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `bun run dev`               | Server with hot reload (`bun --hot src/index.ts`).                    |
| `bun run start`             | Server, no watch (`bun src/index.ts`).                                |
| `bun run check`             | Full gate: type-check + lint + format-check + structure-check + test. |
| `bun run type-check`        | `tsc --noEmit` (strict).                                              |
| `bun run lint` / `lint:fix` | oxlint.                                                               |
| `bun run fmt` / `fmt:check` | oxfmt.                                                                |
| `bun run check:structure`   | `scripts/check-structure.sh` — folder-tree rules.                     |
| `bun run test`              | `bun test` (built-in runner, configured in `bunfig.toml`).            |

## CI

**GitHub Actions** (`.github/workflows/ci.yml`) runs type-check + lint +
format-check + structure-check + test on every PR and push to `main` — the same
checks as `bun run check`.

## Conventions

Strict TypeScript, no barrel files, kebab-case filenames, thin routes + services
for logic, colocated tests with real data, env validated by hand (no schema
library). Full rules in [`CLAUDE.md`](./CLAUDE.md).
