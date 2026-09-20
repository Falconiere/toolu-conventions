---
name: verify-scaffold-recipes
description: Use when changing initializer recipes, template substitutions, or generated project configuration in toolu-conventions.
metadata:
  toolu:
    origin: agent
    created: 2026-09-17T18:59:05Z
---
# Verify scaffold recipes

## When to Use

Changes to `src/recipes.ts`, rendering helpers, or owned stack templates.

## Procedure

1. Reproduce with `resolveConfiguration` and `planRecipe`; inspect the emitted files, not only the template. Add the failing input to `tests/recipes.test.ts`.
2. Match verification to the consumer: parse generated TypeScript and check preserved string values; build Astro output; run a Rust service and probe its configured port. A valid TypeScript string can still fail the generated project's `no-useless-escape` lint rule.
3. Run unit tests, type checking, formatting, and the affected real-project eval. Use `bun test tests/evals/typescript-e2e.test.ts --test-name-pattern 'real console'` or `'real marketing'`; Rust runtime checks are in `tests/evals/rust-e2e.test.ts`. Monorepo output has its own end-to-end gate: `bun test tests/evals/monorepo-e2e.test.ts` generates apps/ + packages/ and runs the generated workspace's own `bun run check`.
4. After inspecting the authored change, refresh affected recipe hashes with `UPDATE_EVAL_GOLDENS=1 bun test tests/evals/scenarios.test.ts`. Review the hash diff, then run the suite without that environment variable.

## Pitfalls

- `planRecipe` unit tests cannot establish that downstream lint/build succeeds.
- A workspace member is not a standalone project: the root owns lefthook, `.oxfmtignore`, `.gitignore`, `.github/`, and `scripts/`. A member that keeps `prepare` or the `lefthook` devDependency fails the generated repo's knip run, and a root `knip.json` workspaces entry rejects root-only keys such as `ignoreExportsUsedInFile`.
- Identifier contexts (`package.json` name, `wrangler.jsonc` name, `Cargo.toml` name) must use `{{TOOLU_PROJECT_SLUG}}`; `{{TOOLU_PROJECT_NAME}}` can hold a dot (`agavus.io`) and a dotted Worker name fails wrangler validation at test time.
- HTML text, Astro attributes, JavaScript string contents, and Markdown require different substitution contexts.
- Compare returned canonical paths with `realpath` on macOS.
- Built-CLI replay fixtures should read the package version; a hardcoded prior minor version tests rejection instead of replay.

## Verification

Run `bun run type-check`, `bun run format:check`, `bun run test:unit`, the scenario evals, and affected real-project evals. For template or packaging changes, also run integration tests and `bash scripts/validate-templates.sh`. Report any failing checks with their actual scope; passing a focused suite does not establish a green full gate.
