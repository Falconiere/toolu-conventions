# Conventions Kit — Design

**Date:** 2026-07-17   **Status:** Reviewed   **Author:** falconiere   **Topic:** AI-agent-runnable conventions kit, core + per-stack modules

## Problem

Every new personal repo restarts the conventions conversation: folder layout, lint/test tooling, naming rules, CI gate. The rules exist (toolu house style) but live in plugin skills and memory, not in a distributable artifact an agent can execute. Result: drift between repos and repeated setup work. The Qwick native boilerplate proved the fix: a markdown kit an agent runs end-to-end (`SETUP.md` + `STRUCTURE.md` + `LIBRARIES.md` + `templates/`) that scaffolds identical projects every time.

## Non-Goals

1. Not a CLI/code generator — markdown docs + copy-ready templates only; a coding agent is the executor.
2. No team/org governance (approval flows, Confluence export). Personal use; a version note in README suffices.
3. No baked-in backend infra (DB, cloud provider, auth vendor) — integrations are opt-in at setup time.
4. No fork-parity with the Qwick kit — it is the model, not an upstream.
5. No monorepo conventions in v1 — single-repo projects only. For Rust this means single-crate only; Cargo workspaces are out of scope.

## Architecture

**Core + per-stack modules.** One stack-agnostic `CORE.md` carries the house rules every repo shares; each stack gets its own mirror of the reference kit under `stacks/<stack>/`. Root `SETUP.md` is a router: intake questions → load `CORE.md` + the chosen stack kit → scaffold → run gate → print human-only checklist.

Driving trade-off: **per-stack maintainability over single-file simplicity.** A monolithic SETUP.md branching across four stacks was rejected — every stack change would churn one giant file and agents would page through three irrelevant stacks. Single-stack-first was rejected because all four stacks were explicitly requested.

Reuse: `CORE.md` codifies the already-enforced toolu conventions (no barrels, kebab-case filename = export, colocated tests, real-data testing, size ceilings, doc lines, docs-in-sync, quality gate). The expo stack derives directly from `SidegigLLC/qwick-native-mobile-boilderplate` (fetched via `gh`); web/backend-ts/rust derive from CORE + curated defaults.

## Interfaces / Schema

```
toolu-convensions/
├── README.md                  # what this is, how to hand it to an agent, version note
├── SETUP.md                   # router: prereq checks → intake → dispatch to stacks/<stack>/SETUP.md
├── CORE.md                    # stack-agnostic conventions (see below)
└── stacks/
    ├── expo/                  # Expo SDK latest · TS strict · Expo Router · bun
    ├── web/                   # Next.js (App Router) · TS strict · bun; Vite variant noted
    ├── backend-ts/            # Bun + Hono · TS strict
    └── rust/                  # single crate default · clippy strict · rustfmt
        # every stack dir has the same four entries:
        ├── SETUP.md           # step-by-step scaffold prompt for this stack
        ├── STRUCTURE.md       # folder tree, hard conventions, path aliases (TS stacks)
        ├── LIBRARIES.md       # reach-for-these list with "when to use" + AVOID list
        └── templates/         # copy-ready configs, CLAUDE.md, CI, primitives
```

`CORE.md` contract (rules later phases inherit): no barrel files; kebab-case filenames named after primary export, one primary export per file; tests colocated (`__tests__/` sibling for TS, `tests/` sibling for Rust) with real-world data, no mock-data tests; ceilings 300 code lines per TS file / 500 per Rust file; concise doc line on every module and public symbol; docs-in-sync rule; quality gate (type-check/lint/format/test) green before advance; pre-commit hooks via Lefthook on every stack, Rust included.

Gate contract — every stack `SETUP.md` MUST define its concrete gate sequence and wire it as one command:

- TS stacks: `bun run check` = `bunx tsc --noEmit` + `bunx oxlint --deny-warnings` + `bunx oxfmt --check` + the stack's test runner (`bun run test`).
- rust: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.

`CLAUDE.md.template` contract (every stack ships one): encodes the CORE rules, the stack's hard conventions and blocked patterns, a repo map, and the gate commands — it is the agent's read-first file in every generated repo.

Per-stack tooling contract:

| Stack | Test | Lint/format | Templates (minimum) |
| --- | --- | --- | --- |
| expo | Jest (`jest-expo`) + RN Testing Library | oxlint + oxfmt, Lefthook | tsconfig, app.config.ts, eas.json, `.eas/workflows/`, `.github/workflows/ci.yml`, jest configs, `.oxlintrc`, lefthook, `.env.example`, `env.ts`, theme (colors/spacing/typography), ui primitives (button/text/text-input + test), CLAUDE.md, folder-README, README |
| web | Vitest + Testing Library | oxlint + oxfmt, Lefthook | tsconfig, next.config, vitest configs, `.oxlintrc`, lefthook, `.env.example`, `env.ts`, theme tokens, CLAUDE.md, folder-README, README, CI |
| backend-ts | bun test | oxlint + oxfmt, Lefthook | tsconfig, bunfig.toml (bun test config), `.oxlintrc`, lefthook, `.env.example`, `env.ts`, Hono app skeleton, CLAUDE.md, folder-README, README, CI |
| rust | cargo test (+ insta opt-in) | clippy (deny warnings) + rustfmt, Lefthook | Cargo.toml skeleton, `rustfmt.toml`, `clippy.toml`/lints table, lefthook, CLAUDE.md, folder-README, README, CI |

Root `SETUP.md` intake questions (fixed order):

1. **Stack** — expo / web / backend-ts / rust.
2. **Project name.**
3. **Staging env?** — asked for expo, web, backend-ts; never for rust.
4. **Optional integrations** — stack-specific menu:

   | Stack | Integration options (each opt-in; option → what it wires) |
   | --- | --- |
   | expo | API layer (`src/api/` clients + React Query hooks) · auth scaffold (secure token storage via `expo-secure-store` + auth provider) · local storage (`@react-native-async-storage/async-storage`) |
   | web | API layer (`src/api/` clients + React Query hooks) · auth scaffold (Auth.js) · DB client (none by default; named at intake) |
   | backend-ts | DB client (named at intake, e.g. postgres via `bun:sql` or drizzle) · auth middleware (bearer-token skeleton) · structured logging (pino) |
   | rust | CLI parsing (`clap`) · HTTP service (`axum` + `tokio`) · serialization (`serde`/`serde_json`) |

5. **Design context** — expo and web only: free-text description of brand/look (colors, tone, reference apps). Consumed by the theme token templates (`colors.ts`/`typography.ts` values) and recorded in the generated app's `CLAUDE.md` design-notes section.

Ends by printing a human-only checklist (logins, store credentials, secrets).

## Acceptance criteria

- **AC-1:** Repo contains root `README.md`, `SETUP.md`, `CORE.md`, and all four `stacks/<stack>/` dirs each holding non-empty `SETUP.md`, `STRUCTURE.md`, `LIBRARIES.md`, and a `templates/` dir containing at least the templates listed in the table above (verified by listing the tree).
- **AC-2:** Following `stacks/expo/SETUP.md` verbatim in an empty directory yields a project where `bun run check` passes — i.e. `bunx tsc --noEmit`, `bunx oxlint --deny-warnings`, `bunx oxfmt --check`, and `bun run test` all exit 0 on the actually scaffolded project, no mocks.
- **AC-3:** Template-level validation for all stacks: every `.json` template parses via `jq` (JSON templates are comment-free by rule; tsconfig ships without comments), every `.yml`/`.yaml` via a YAML parser, every `.toml` via a TOML parser; every TS/TSX template passes `bunx oxlint --deny-warnings` using a dedicated non-type-aware validation config (`scripts/oxlintrc.templates.json`) — type-aware rules from the stack's shipped `.oxlintrc` are exercised inside the AC-2 scaffold, not standalone; dependency-free TS templates (theme tokens; enumerated in the validation script) additionally pass `bunx tsc --strict --noEmit`; the rust skeleton is materialized into a temp crate (real `Cargo.toml` + `src/`, zero default dependencies so it resolves offline) and passes `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`. TS templates importing third-party libs type-check only inside a scaffold with deps installed (expo covered by AC-2; web/backend-ts deferred per OQ-1).
- **AC-4:** `CORE.md` states every rule in the CORE contract above; each stack `STRUCTURE.md` contains a folder tree, a hard-conventions list, and (TS stacks) a path-alias table; each stack `SETUP.md` defines its concrete gate sequence per the gate contract.
- **AC-5:** Docs in sync — root `README.md` explains the hand-to-agent usage flow and carries a version note (`v0.1`, date).

## Open Questions

- **OQ-1** — RESOLVED (default taken): expo-only end-to-end scaffold in v1; web/backend-ts/rust validated at template level per AC-3.
- **OQ-2** — RESOLVED (default taken): web kit ships Next.js-only; Vite noted as a variant in `stacks/web/LIBRARIES.md`.
