# toolu-convensions

A distributable, **AI-agent-runnable** conventions kit for spinning up new
projects. Hand [`SETUP.md`](./SETUP.md) to a coding agent (Claude Code, Cursor,
…) and it scaffolds a project with the same conventions, folder structure, and
tooling every time — across four stacks.

Modeled on the Qwick native boilerplate pattern: markdown an agent executes,
plus copy-ready templates. No CLI, no generator.

## Layout

| Path | Purpose |
| --- | --- |
| [`SETUP.md`](./SETUP.md) | ★ Entry point. Router: prereq checks → intake questions → dispatch to a stack kit. |
| [`CORE.md`](./CORE.md) | Stack-agnostic house rules every stack inherits (no barrels, colocated real-data tests, size ceilings, quality gate). |
| [`DESIGN.md`](./DESIGN.md) | Stack-agnostic UI/UX language (CodaSignal "Signal") the `expo`/`web` theme tokens ship pre-filled with. |
| `stacks/expo/` | Expo (latest SDK) · TypeScript strict · Expo Router · bun · Jest. |
| `stacks/web/` | Next.js (App Router) · TypeScript strict · bun · Vitest. |
| `stacks/backend-ts/` | Bun + Hono · TypeScript strict · bun test. |
| `stacks/rust/` | Single crate · clippy `-D warnings` · rustfmt · cargo test. |
| `scripts/` | Dev-only kit-maintenance tooling (template validation). Not part of the distributed kit. |

Each `stacks/<stack>/` holds the same four things: `SETUP.md` (step-by-step
scaffold prompt), `STRUCTURE.md` (folder tree + hard conventions),
`LIBRARIES.md` (reach-for-these list + AVOID list), `templates/` (copy-ready
files under their real filenames; only `CLAUDE.md.template` is suffixed).

## How to use it

1. Create the new empty repo/folder for the project.
2. Make sure the agent can read this kit (clone it next to the project).
3. Tell the agent: **"Set up this project by following `SETUP.md`."**
4. Answer the intake questions (stack, name, staging?, integrations, design
   context).
5. Complete the human-only checklist the agent prints at the end.

## Maintaining

When a convention changes, update `CORE.md` / `DESIGN.md` or the stack kit AND
its templates together — docs and templates stay in lockstep. Re-run
`bash scripts/validate-templates.sh` before distributing. Design docs live in
`docs/toolu/` (spec + plan).

> **Version:** v0.1 (2026-07) · initial release: core + expo/web/backend-ts/rust
> kits; expo validated end-to-end, other stacks template-validated.
