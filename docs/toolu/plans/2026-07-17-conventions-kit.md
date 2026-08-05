# Conventions Kit — Build Plan

**Date:** 2026-07-17   **Status:** Approved   **Spec:** docs/toolu/specs/2026-07-17-conventions-kit-design.md   **Topic:** Author root docs + four stack kits + validation

## Context

Empty repo becomes a distributable, agent-runnable conventions kit: core house rules + per-stack setup kits (expo, web, backend-ts, rust), modeled on a private native boilerplate. The spec is reviewed; this plan sequences authoring and validation so every acceptance criterion has a runnable check.

## Approach

Core + per-stack modules per spec. Root docs first (CORE.md is the contract every stack kit references), then the four stack kits in parallel subagents, then template-level validation for all stacks and an end-to-end expo scaffold (OQ-1 resolved: expo-only e2e in v1; OQ-2 resolved: web is Next.js-only, Vite noted as variant in `stacks/web/LIBRARIES.md`). The expo kit derives from the reference clone at the session scratchpad (`native-ref`); web/backend-ts/rust derive from CORE + the spec's tooling table.

Authoring decisions the steps encode:

- **Template naming:** templates ship under their REAL filenames (`stacks/expo/templates/tsconfig.json`, `templates/theme/colors.ts`) so sibling imports and validators resolve. Sole exception: `CLAUDE.md.template` — a bare `CLAUDE.md` inside this repo would be ingested by Claude Code sessions working on the kit itself.
- **JSON templates are comment-free** (tsconfig included) so `jq` stays the validator.
- **Template lint:** standalone template pass uses a dedicated non-type-aware config `scripts/oxlintrc.templates.json`; the stacks' shipped `.oxlintrc.json` (type-aware) is exercised only inside the AC-2 scaffold.
- **Rust skeleton has zero default dependencies** — materialized into a temp crate for `cargo fmt --check` + `cargo clippy` so it validates offline. Integrations (clap/axum/serde) are opt-in additions documented in SETUP.md, not shipped in the skeleton.
- **`scripts/` is dev-only kit-maintenance tooling**, not part of the distributed kit — README says so.

## Steps / workstreams

1. **root-docs** — `README.md` (usage flow, v0.1 version note, scripts/ dev-only note), `SETUP.md` (prereq checks, 5 intake questions incl. per-stack integration menu, dispatch to `stacks/<stack>/SETUP.md`, human-only checklist), `CORE.md` (every CORE rule + gate contract + CLAUDE.md contract).
2. **expo-kit** — adapt from `native-ref` (drop org-specific details, align to CORE.md, real-name templates per spec table).
3. **web-kit** — Next.js App Router, TS strict, bun, Vitest + Testing Library, oxlint/oxfmt, Lefthook; Vite variant noted in LIBRARIES.md.
4. **backend-ts-kit** — Bun + Hono (`templates/src/app.ts` Hono app, `templates/src/index.ts` serve entry), bun test via bunfig.toml.
5. **rust-kit** — single crate, zero-dep skeleton (`Cargo.toml` with `[lints]` table, `src/main.rs`), rustfmt.toml, Lefthook, cargo test.
6. **validate-templates** — write `scripts/validate-templates.sh` + `scripts/oxlintrc.templates.json`; parse all JSON/YAML/TOML, oxlint TS/TSX templates (non-type-aware config), `bunx tsc --strict --noEmit` on the enumerated dependency-free templates (theme token files), materialize rust skeleton to temp crate for fmt+clippy. Run green.
7. **expo-scaffold-e2e** — follow `stacks/expo/SETUP.md` verbatim in `<session scratchpad>/expo-smoke/`; `bun run check` exits 0.
8. **docs-sync-check** — README matches actual layout; version note present.

## Steps (machine-readable)

```json
[
  {"id": "root-docs", "title": "Author README.md, SETUP.md, CORE.md", "check": "test -s README.md && test -s SETUP.md && test -s CORE.md && grep -q 'v0.1' README.md && grep -qi 'barrel' CORE.md && grep -qi 'kebab' CORE.md && grep -q '__tests__' CORE.md && grep -q '300' CORE.md && grep -q '500' CORE.md && grep -qi 'lefthook' CORE.md && grep -qiE 'docs.in.sync|docs in sync' CORE.md && grep -q 'bun run check' CORE.md && grep -q 'cargo clippy' CORE.md && grep -qi 'mock' CORE.md && grep -qi 'doc line\\|doc-line\\|documentation line' CORE.md", "ac_refs": ["AC-4", "AC-5"]},
  {"id": "expo-kit", "title": "Author stacks/expo kit from reference", "check": "for f in SETUP.md STRUCTURE.md LIBRARIES.md templates/tsconfig.json templates/app.config.ts templates/eas.json templates/.eas/workflows templates/.github/workflows/ci.yml templates/jest.config.js templates/jest.setup.ts templates/.oxlintrc.json templates/lefthook.yml templates/.env.example templates/env.ts templates/theme/colors.ts templates/theme/spacing.ts templates/theme/typography.ts templates/ui/button.tsx templates/ui/text.tsx templates/ui/text-input.tsx templates/ui/__tests__/button.test.tsx templates/CLAUDE.md.template templates/folder-README.md templates/README.md; do test -e \"stacks/expo/$f\" || exit 1; done && grep -q '@/' stacks/expo/STRUCTURE.md && grep -q 'bun run check' stacks/expo/SETUP.md", "ac_refs": ["AC-1", "AC-4"], "depends_on": ["root-docs"], "input": "scratchpad native-ref clone"},
  {"id": "web-kit", "title": "Author stacks/web kit", "check": "for f in SETUP.md STRUCTURE.md LIBRARIES.md templates/tsconfig.json templates/next.config.ts templates/vitest.config.ts templates/vitest.setup.ts templates/.oxlintrc.json templates/lefthook.yml templates/.env.example templates/env.ts templates/theme/colors.ts templates/theme/spacing.ts templates/theme/typography.ts templates/.github/workflows/ci.yml templates/CLAUDE.md.template templates/folder-README.md templates/README.md; do test -e \"stacks/web/$f\" || exit 1; done && grep -q '@/' stacks/web/STRUCTURE.md && grep -q 'bun run check' stacks/web/SETUP.md && grep -qi 'vite' stacks/web/LIBRARIES.md", "ac_refs": ["AC-1", "AC-4"], "depends_on": ["root-docs"]},
  {"id": "backend-ts-kit", "title": "Author stacks/backend-ts kit", "check": "for f in SETUP.md STRUCTURE.md LIBRARIES.md templates/tsconfig.json templates/bunfig.toml templates/.oxlintrc.json templates/lefthook.yml templates/.env.example templates/env.ts templates/src/app.ts templates/src/index.ts templates/.github/workflows/ci.yml templates/CLAUDE.md.template templates/folder-README.md templates/README.md; do test -e \"stacks/backend-ts/$f\" || exit 1; done && grep -q '@/' stacks/backend-ts/STRUCTURE.md && grep -q 'bun run check' stacks/backend-ts/SETUP.md", "ac_refs": ["AC-1", "AC-4"], "depends_on": ["root-docs"]},
  {"id": "rust-kit", "title": "Author stacks/rust kit", "check": "for f in SETUP.md STRUCTURE.md LIBRARIES.md templates/Cargo.toml templates/rustfmt.toml templates/lefthook.yml templates/src/main.rs templates/.github/workflows/ci.yml templates/CLAUDE.md.template templates/folder-README.md templates/README.md; do test -e \"stacks/rust/$f\" || exit 1; done && grep -q 'cargo clippy' stacks/rust/SETUP.md && grep -q '\\[lints' stacks/rust/templates/Cargo.toml", "ac_refs": ["AC-1", "AC-4"], "depends_on": ["root-docs"]},
  {"id": "validate-templates", "title": "Write and run scripts/validate-templates.sh", "check": "bash scripts/validate-templates.sh", "ac_refs": ["AC-3"], "depends_on": ["expo-kit", "web-kit", "backend-ts-kit", "rust-kit"]},
  {"id": "expo-scaffold-e2e", "title": "Scaffold expo app from kit, gate green", "check": "cd /private/tmp/claude-501/-Users-falconiere-Projects-toolu-convensions/e25e902a-e2f2-47ad-a2e6-0e19b756bc72/scratchpad/expo-smoke4 && bun run check", "ac_refs": ["AC-2"], "depends_on": ["expo-kit"], "input": "stacks/expo/SETUP.md followed verbatim"},
  {"id": "docs-sync-check", "title": "README matches layout, version note present", "check": "grep -q 'stacks/' README.md && grep -q 'v0.1' README.md && grep -qi 'dev-only\\|maintenance' README.md", "ac_refs": ["AC-5"], "depends_on": ["expo-kit", "web-kit", "backend-ts-kit", "rust-kit"]}
]
```

## Critical files

Create: `README.md`, `SETUP.md`, `CORE.md`, `stacks/{expo,web,backend-ts,rust}/{SETUP.md,STRUCTURE.md,LIBRARIES.md}`, `stacks/*/templates/*` (real filenames per spec table; `CLAUDE.md.template` excepted), `scripts/validate-templates.sh`, `scripts/oxlintrc.templates.json`. Replace the empty `readme.md` with `README.md`. No other existing files.

## Verification

`bash scripts/validate-templates.sh` green (AC-3); per-step enumerated tree checks satisfy AC-1/AC-4; expo scaffold at the session scratchpad passes `bun run check` (AC-2, real scaffold, no mocks); README greps for AC-5. Kit is docs+templates — the scaffold smoke test is the real-data path.
