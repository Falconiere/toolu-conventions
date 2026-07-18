# Project Structure & Conventions

The canonical layout every new backend-ts service produces. It inherits the
stack-agnostic rules in [`../../CORE.md`](../../CORE.md) — this file adds the
Bun + Hono specifics and never relaxes a CORE rule. Designed for **thin routes,
testable services, and easy LLM traversal**: predictable folder names, a README
in every source directory, no barrel files (every import points at the file that
holds the thing).

## Folder tree

```
<app>/
├── src/
│   ├── app.ts            # The Hono app — routes + middleware mounted here (wiring only)
│   ├── index.ts          # Server entry — Bun.serve(app.fetch) on the validated PORT
│   ├── routes/           # One module per resource — thin HTTP handlers. README.md
│   │   └── __tests__/    #   route tests via app.request(...)
│   ├── services/         # Business logic — framework-agnostic, unit-testable. README.md
│   │   └── __tests__/
│   ├── utilities/        # Shared pure helpers (dates, formatters, …). README.md
│   ├── constants/        # env.ts (hand-validated), enums. README.md
│   └── types/            # Cross-cutting TS types. README.md
├── scripts/              # check-structure.sh — folder-tree gate (part of `bun run check`)
├── tsconfig.json         # strict + path alias
├── bunfig.toml           # Bun runtime + `bun test` config
├── .oxlintrc.json · .oxfmtrc.json · lefthook.yml
├── .env.example
├── .github/workflows/    # GitHub Actions — CI gate (type-check/lint/fmt/structure/test)
├── CLAUDE.md             # agent rules + repo map (read first)
└── README.md             # human + agent entry point
```

> Folder vocabulary (`routes`, `services`, `utilities`, `constants`, `types`) is
> intentional. Middleware and a DB layer are added under `src/middleware/` and
> `src/db/` respectively **only when** an integration is wired — add the new dir to
> `allowed_dirs` in `scripts/check-structure.sh` when you do (see `SETUP.md`).

## Path alias

Configured in `tsconfig.json` and resolved natively by Bun at runtime. Always
import via the alias — never deep relative paths like `../../services/health`.

```ts
@/*   → src/*
```

So `@/app`, `@/constants/env`, `@/routes/health-route`, and
`@/services/health-service` all resolve from anywhere in the tree.

## App assembly & serving

Two files, one job each — keep them separate:

- **`src/app.ts`** builds and exports the Hono `app`. Every route module and every
  middleware is mounted here. This file is **wiring only** — no business logic,
  no `Bun.serve`. Tests import `app` and call `app.request('/path')`, so the app
  is exercisable without opening a socket.
- **`src/index.ts`** is the process entry: it imports `app` and the validated
  `PORT`, calls `Bun.serve({ port, fetch: app.fetch })`, and prints the listening
  address. Nothing else. `bun run dev` runs it with `--hot`.

```ts
// src/index.ts
import { app } from '@/app';
import { PORT } from '@/constants/env';

const server = Bun.serve({ port: PORT, fetch: app.fetch });
process.stdout.write(`Listening on http://localhost:${server.port}\n`);
```

## Hard conventions

These inherit CORE. Most are **machine-enforced** by `bun run check` — via
`.oxlintrc.json` (oxlint), `scripts/check-structure.sh` (folder tree), and Lefthook
pre-commit — so the gate fails on a violation rather than a reviewer catching it.
Each rule below names its enforcer; `(review)` means it's a convention a human/agent
upholds, not yet a machine check. See
[`templates/CLAUDE.md.template`](./templates/CLAUDE.md.template) for the full
blocked-patterns list.

1. **No barrel files.** Never an `index.ts` that only re-exports. Import the
   concrete file: `import { getHealth } from '@/services/health-service'`. —
   enforced by `no-restricted-imports` (barrel imports) + `check-structure.sh`
   (no `index.ts` under `src/` except the `src/index.ts` entry).
2. **No deep relative imports.** Use the `@/` alias, never `../../x`. — enforced
   by `no-restricted-imports` (`../../*` pattern).
3. **Thin routes.** A module under `src/routes/` parses the request, calls a
   service, and shapes the response — no business logic, no direct DB access. —
   (review).
4. **Services hold logic.** Put the real work in `src/services/` as
   framework-agnostic functions, so they unit-test without the HTTP layer. —
   (review).
5. **One route module per resource.** `src/routes/user-route.ts` owns `/users`;
   mount it in `src/app.ts`. — (review).
6. **Allowed `src/` layout.** Only `routes services utilities constants types` as
   top-level dirs (each with a `README.md`), plus `app.ts` + `index.ts` at the
   root. — enforced by `check-structure.sh`.
7. **Filename ↔ content.** Kebab-case filenames named after the export
   (`health-service.ts` → `getHealth`). One primary export per file. — enforced by
   `unicorn/filename-case` (kebab-case); one-export-per-file is (review).
8. **Named exports only.** No default exports anywhere — every symbol is grep-able
   by name. — (review).
9. **Co-locate tests** in a sibling `__tests__/`: `health-service.ts` →
   `__tests__/health-service.test.ts`. Keep the test tree flat. — enforced by
   `check-structure.sh` (fails on centralized test dirs and any `*.test.*` under
   `src/` outside a `__tests__/`).
10. **No `any`.** No `as any`, `: any`, `as unknown as T`. Use `unknown` + type
    guards. — enforced by `typescript/no-explicit-any` + the `no-unsafe-*` family.
11. **No `console.log` / `debugger`.** Use `console.warn` / `console.error`, the
    structured logger (if wired), or `process.stdout.write` for a startup banner. —
    enforced by `no-console` (warn/error only) + `no-debugger`.
12. **Hand-validated env.** `src/constants/env.ts` validates the process env by
    hand — no schema library app-wide. — (review).
13. **`max-lines: 300`** per file, code lines only (blanks/comments skipped; tests
    exempt). — enforced by `max-lines`.

## LLM-indexability strategy

An agent should answer "where does X live / is there already a service for Y?"
without reading the whole tree. We get that from:

- **A README in every `src/*` folder** (from
  [`templates/folder-README.md`](./templates/folder-README.md)) listing what
  belongs there, what's inside (one line each), and where NOT to put things.
- **`CLAUDE.md` at the root** as the map + rulebook, read first by agents.
- **No barrels + filename ↔ content** — grep for a symbol lands on its definition.
- **The `@/` alias** makes import sites self-describing
  (`@/services/health-service` tells you exactly where it is).

When you add a notable service/route/utility, add a one-line entry to that
folder's README so the index stays current.
