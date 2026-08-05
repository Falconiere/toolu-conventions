# toolu-conventions

A distributable, **AI-agent-runnable** conventions kit for spinning up new
projects. Hand [`SETUP.md`](./SETUP.md) to a coding agent (Claude Code, Cursor,
…) and it scaffolds a project with the same conventions, folder structure,
tooling, and guard rails every time — across five stacks.

Modeled on a proven native boilerplate pattern: markdown an agent executes,
plus copy-ready templates. No CLI, no generator.

**Human-readable guide:** <https://falconiere.github.io/toolu-conventions/> —
product shape, folder trees, rules, and guard rails in one page, plus the
[design system](https://falconiere.github.io/toolu-conventions/design-system.html)
built from the theme tokens the kit actually ships. Served by GitHub Pages from
[`docs/`](./docs/) on `main`; the same files open directly in a browser.

## Layout

| Path | Purpose |
| --- | --- |
| [`SETUP.md`](./SETUP.md) | ★ Entry point. Router: prereq checks → intake questions → dispatch to a stack kit. |
| [`CORE.md`](./CORE.md) | Stack-agnostic house rules every stack inherits — hard rules, the platform defaults, and the five guard-rail layers. |
| [`DESIGN.md`](./DESIGN.md) | Stack-agnostic UI/UX language (CodaSignal "Signal") the `console`/`marketing`/`expo` theme tokens ship pre-filled with. |
| `stacks/console/` | The authenticated product app — React + Vite + TanStack Router · TS strict · bun · Vitest → Cloudflare Workers. |
| `stacks/marketing/` | The public website — Astro (static) · TS strictest · bun · Vitest → Cloudflare Workers. |
| `stacks/backend-ts/` | The HTTP API — Hono on Cloudflare Workers (workerd) · Turso · Vitest in the real runtime. |
| `stacks/expo/` | Expo (latest SDK) · TypeScript strict · Expo Router · bun · Jest. |
| `stacks/rust/` | Single crate · clippy `-D warnings` · rustfmt · cargo test. |
| `scripts/` | Dev-only kit-maintenance tooling (template validation). Not part of the distributed kit. |

Each `stacks/<stack>/` holds the same four things: `SETUP.md` (step-by-step
scaffold prompt), `STRUCTURE.md` (folder tree + hard conventions),
`LIBRARIES.md` (reach-for-these list + AVOID list), `templates/` (copy-ready
files under their real filenames; only `CLAUDE.md.template` is suffixed).

## The defaults, in one place

One answer per job, so no project re-litigates them:

- **Host:** Cloudflare Workers · **Database:** Turso · **Auth:** better-auth
- **Validation:** Zod at every boundary, types from `z.infer`
- **Client data:** TanStack Query (+ `@orpc/tanstack-query` for our API)
- **Forms:** TanStack Form (`@tanstack/react-form`) + Zod
- **Our own API:** oRPC — procedures typed end to end; query keys from the
  procedure path
- **HTTP for everything else:** the kit's own `src/utilities/http.ts` over
  `fetch` — **axios is banned**, in lint *and* in the structure check
- **Package manager:** bun · **Lint/format:** oxlint + oxfmt · **Hooks:** Lefthook
- **Gate extras:** knip (unused files/exports/deps) + jscpd (copy-paste)
- **Structure gate:** oxlint house plugin (folder tree, barrels, patterns) +
  `agent-guardrails` for what the linter cannot see (needs `jq`)

A full product is usually three repos from this kit — `marketing` (the public
site), `console` (the app behind the login), and `backend-ts` (the API they both
talk to). They share one design language and one token set.

## Guard rails

Every generated project ships five layers, and the kit treats all five as
mandatory: the rules in `CLAUDE.md`; **agent hooks** (`.claude/settings.json`)
that run `agent-guardrails` on every file an agent writes and again before it
finishes a turn; Lefthook pre-commit; a CI gate (`ci.yml`) whose steps mirror
`bun run check` one-for-one and end in a real build; and an AI code review
(`code-review.yml`) that judges each PR against the repo's own convention files
read from the base branch. Details in [`CORE.md`](./CORE.md).

**`agent-guardrails`** ([`guardrails/`](./guardrails/)) is the kit's structural
gate — one config-driven module, copied verbatim into every project, that
enforces what a linter cannot see: per-folder READMEs, required files, shadowing
configs, banned dependencies, committed secrets — and the whole Rust stack.
Everything that *is* visible to a linter (folder tree, intra-domain shape,
barrels, colocated tests, bare `fetch`, hardcoded colours) runs inside **oxlint**
via the house plugin it ships, so those rules fire as the file is written and
there is exactly one enforcer each. Stack differences are data
(`guardrails.config.json`), not code; `ownedByLinter` there declares the split.
It replaced five hand-written per-stack scripts that had already drifted apart.

**The kit runs them on itself.** `.github/workflows/ci.yml` runs
`scripts/validate-templates.sh` on every PR, and `.github/workflows/code-review.yml`
reviews each PR against [`CORE.md`](./CORE.md). A kit that preaches four
mandatory layers while running none of them is just a document — so
`validate-templates.sh` now fails if either workflow goes missing.

## How to use it

1. Create the new empty repo/folder for the project.
2. Make sure the agent can read this kit (clone it next to the project).
3. Tell the agent: **"Set up this project by following `SETUP.md`."**
4. Answer the intake questions (stack, name, staging?, integrations, design
   context).
5. Complete the human-only checklist the agent prints at the end.

## Maintaining

When a convention changes, update `CORE.md` / `DESIGN.md` or the stack kit AND
its templates together — docs and templates stay in lockstep. Run
`bash scripts/validate-templates.sh` before distributing; CI runs the same
command on every PR. Design docs live in `docs/toolu/` (spec + plan).

`validate-templates.sh` is the only gate this repo has, so it is worth knowing
what it actually covers: every JSON/JSONC/YAML/TOML template parses; every
TS/TSX template passes oxfmt and is linted **twice** — once with a minimal
config and once with each stack's real `.oxlintrc.json`, at project-relative
paths so the config's `overrides` match as they will in a scaffold; the
dependency-free templates and `http.ts` strict-type-check; the `--tone-*` values
agree across `theme/colors.ts` and both stylesheets; cross-stack template
references resolve; every stack ships both workflows plus `knip.json` and a
`.jscpd.json` with `exitCode: 1`; and the rust skeleton passes fmt + clippy in a
temp crate. Adding a convention usually means adding a check here too.

> **Version:** v0.2 (2026-07) · `web` renamed to `console` and rebuilt on
> React + Vite + TanStack Router; new `marketing` (Astro) kit; `backend-ts`
> moved to Cloudflare Workers + Turso; better-auth adopted; oRPC + TanStack
> Query as the API layer; Zod adopted as the one validator (replacing
> hand-written guards); axios replaced by the kit's `http.ts`; knip + jscpd
> added to the gate; `code-review.yml` added to every stack — and to this repo,
> which now runs its own CI. Expo validated end-to-end, other stacks
> template-validated.
