# Core Conventions

Stack-agnostic house rules. Every stack kit under `stacks/` inherits these; a
stack's `STRUCTURE.md` may add rules but never relax one. Agents scaffolding a
project read this file first, then the chosen stack kit.

## Hard rules

1. **No barrel files.** Never create an `index.ts(x)` / `mod.rs` whose only job
   is re-exporting. Import the concrete file that holds the thing. Every symbol
   stays traceable to exactly one file — the single most useful property for an
   agent navigating a repo. Sanctioned exception: framework ROUTE files
   (`app/**` in Expo Router) that exist to re-export a feature screen.
2. **Named exports.** One primary export per file, exported by name, so grep
   lands on the definition. Exactly two framework-mandated exceptions exist, and
   each is machine-scoped to a single path: Expo Router route files, and the
   Cloudflare Worker entry (`src/index.ts` must default-export the app). The
   console stack has **no** exception — TanStack Router route files export a
   named `Route`.
3. **Filename ↔ content.** Kebab-case filenames (Rust: snake_case per language
   norm); the file is named after its primary export (`shift-card.tsx` →
   `ShiftCard`, `use-shifts.ts` → `useShifts`).
4. **One responsibility per file.** A file does one thing. Flat until it grows:
   keep a unit as a single file until it passes the size ceiling or sprouts
   sub-parts, then promote it to a folder.
5. **Size ceilings.** Max **300 code lines per TypeScript file**, **500 per Rust
   file** (blanks/comments excluded; tests exempt). If a design implies a bigger
   file, split the design — don't fight the gate later.
6. **Tests colocate.** TypeScript: sibling `__tests__/` folder
   (`button.tsx` → `__tests__/button.test.tsx`). Rust: sibling `tests/` folder
   (`parse_config.rs` → `tests/parse_config.rs`) — **never** put tests in the
   same file as the logic (no in-file `#[cfg(test)] mod tests { … }` bodies).
   Keep test trees flat.
7. **Real data, no mock-data tests.** Tests exercise real inputs and real
   integration paths. A test that only proves a mock returns what the mock was
   told to return is banned — it hides integration breakage.
8. **Doc line required.** Every module and public symbol carries a concise doc
   line (TS: leading `/** … */` one-liner; Rust: `///`). Brief, but not
   optional.
9. **Docs in sync.** A change that touches a user-facing surface (behavior,
   public API, CLI flags, commands, config) updates the prose that describes it
   — README, guides, release notes — in the same change.
10. **No `any`.** No `as any`, `: any`, `as unknown as T`. Data of unknown shape
    stays `unknown` until it is **parsed with a Zod schema** (rule 13). Rust
    equivalent: no `unwrap()`/`expect()` outside tests and `main` bootstrap —
    propagate errors.
11. **No `console.log` / `debugger`** in committed code. Use
    `console.warn`/`console.error` (TS) or a logger. Rust: no stray `println!`
    debugging — use `eprintln!`/`tracing`.
12. **No secret in a committed file.** Public/build-time config is validated in
    one env module per project; secrets live in the platform's secret store
    (`wrangler secret put`, EAS env, the host's settings) and in a git-ignored
    local file. Every TS stack ships an env module that says, in the file, which
    half it holds.
13. **Validate every boundary with Zod.** Environment variables, HTTP response
    bodies, request bodies, webhook payloads, parsed files, anything from
    `localStorage` — if the data crosses into the program from outside, a Zod
    schema is what lets it in, and the TypeScript type is **inferred from that
    schema** (`z.infer`), never declared separately and hoped to match.
    Hand-written type guards are not the house style: one schema is easier to
    read than five guards, reports every bad field at once instead of the first,
    and cannot drift from the type it certifies. Inside the program — between
    your own functions — types are enough; do not re-parse what you just built.

    ```ts
    const Shift = z.object({ id: z.string(), startsAt: z.iso.datetime() });
    type Shift = z.infer<typeof Shift>;              // the type follows the schema

    const shifts = await http.get('/shifts', { parse: (b) => z.array(Shift).parse(b) });
    ```

## Platform defaults

The kit has one answer per job. Deviating is allowed — documenting the deviation
in the project's `CLAUDE.md` is not optional.

| Job | The house choice | Notes |
| --- | --- | --- |
| Hosting / runtime | **Cloudflare Workers** | Console and marketing deploy as static assets; the API is a Worker. `wrangler.jsonc` in every TS project. |
| Database | **Turso** | Reached with `@tursodatabase/serverless` (fetch-only, runs on workerd). Only server-side code touches it. |
| Auth | **better-auth** | Server half in the API service (owns the tables); clients hold only `createAuthClient`. No auth secret ever ships in a client bundle. |
| HTTP client | **`src/utilities/http.ts`** | The kit's own `fetch` wrapper — `get`/`post`/`put`/`patch`/`delete`, base URL, timeouts, typed errors. **`axios` is banned** in every TS stack, in lint *and* in the structure check. |
| Validation | **Zod 4** | Every boundary: env, response and request bodies, webhooks, storage, forms. Types come from `z.infer`. `yup`/`joi`/`valibot` and hand-rolled guards are out — one validator, everywhere. |
| API between our own apps | **oRPC** (`@orpc/server` / `@orpc/client`) | Procedures with Zod input *and* output schemas; the client is typed from the same declaration, so the contract cannot drift. Served at `/rpc`. |
| Server state on the client | **TanStack Query** (`@tanstack/react-query`) + `@orpc/tanstack-query` | `orpc.<procedure>.queryOptions(...)` — query keys derive from the procedure path, so there is no key factory to hand-write and none to get wrong. |
| Forms on the client | **TanStack Form** (`@tanstack/react-form`) + Zod | One form library across console and expo. Pass Zod schemas directly via Standard Schema (`validators: { onChange: schema }`) — **do not** add `@tanstack/zod-form-adapter` (deprecated). Prefer the same Zod schema as the matching oRPC input when fields align. |
| Dead code + unused deps | **knip** | Part of the gate. An unused export or a dependency nobody imports fails the build, which is what keeps "lean" true over time instead of aspirational. |
| Copy-paste detection | **jscpd** | Part of the gate, at `threshold: 0` with `exitCode: 1`. Duplication is the failure mode the size ceilings push you toward if nothing is watching. |
| Package manager | **bun** | Install and scripts. Note it is *not* the runtime for the Workers stacks. |
| Web app | **React + Vite + TanStack Router** (`console`) | The authenticated product. Client-rendered SPA. |
| Public site | **Astro** (`marketing`) | Static, multi-page, crawlable. A different stack because content and app want opposite defaults. |

## Quality gates & guardrails

Five layers. A project is only correct when all five are green, and **none of
them may be disabled to get there** — not for an unrelated failure, not "just
this once". If a check is wrong, fix the check deliberately and say so; don't
route around it.

They are ordered by how early they catch a mistake, and the earliest is the
cheapest: a rule that fires while the agent is still writing the file costs one
edit, the same rule at PR time costs a review cycle.

**1. The rules, in the repo.** Every generated project ships a `CLAUDE.md` (from
the stack kit's `CLAUDE.md.template`) — the agent's read-first file, encoding
these core rules, the stack's hard conventions and blocked patterns, a repo map,
and the exact gate commands. Rules an agent can't see are rules that don't exist.

**2. Agent hooks (`.claude/settings.json`), while the code is being written.**
Committed, so every agent working in the repo inherits them.

- `PostToolUse` on `Edit|Write` runs `bash scripts/guardrails/run.sh --hook`
  against the single file just written, in milliseconds. It cannot block — the
  write already happened — but exit 2 puts the violation and its remedy in front
  of the agent, which fixes it in the same turn.
- `Stop` runs `bash scripts/guardrails/run.sh --stop` over the whole repo. This
  one *does* block: exit 2 means the agent keeps working instead of handing over
  red code. It early-outs (exit 0) when nothing changed this turn or when it is
  already continuing from a previous block, and Claude Code caps the loop at 8
  consecutive blocks, so it cannot trap a session.

This layer fires for **coding agents only** — never for a human in an editor.
That is exactly why it does not replace any of the layers below it.

**3. Pre-commit (Lefthook), on every stack including Rust.** Fast staged-file
checks only — format + lint. Config must be `lefthook.yml`; a `lefthook.yaml` is
silently shadowed by the 2.x installer's stub, and the hooks then never run.

**4. The gate — ONE command, run before every push.**

- **TypeScript stacks** — `bun run check` =
  type-check + `bunx oxlint --deny-warnings` + `bunx oxfmt --check` +
  `bash scripts/guardrails/run.sh` + `bunx knip` + `bunx jscpd` + the test
  runner, in that order. ("Type-check" is `tsc --noEmit`, except in the marketing
  stack, where it is `astro check` — the only tool that reads an `.astro`
  file's TEMPLATE body. oxlint reads its frontmatter too; oxfmt cannot parse
  `.astro` at all.)
- **Rust** —
  `cargo fmt --check && cargo clippy --all-targets -- -D warnings && bash scripts/guardrails/run.sh && cargo test`.

Structure rules are machine-enforced, not doc-only. The division of labour is
deliberate: **one rule, one enforcer.** Two enforcers of one ceiling is how the
two numbers drift apart, and how an `oxlint-disable` silences half a rule.

- **oxlint** owns what it can see in TypeScript: `no-restricted-imports` (no
  barrel imports, no deep relatives, feature isolation, **no axios**, no
  competing validation library), `import/no-default-export`,
  `unicorn/filename-case` (kebab-case), `max-lines` (300 code lines, tests
  exempt) and `max-lines-per-function` (50; 80 in `.tsx`, where a component's
  JSX body legitimately runs longer). Rust's equivalents are clippy's
  `too_many_lines` and rustfmt.
- **oxlint also owns the structural rules**, through the house plugin at
  `scripts/guardrails/oxlint-plugin/` (`jsPlugins` in `.oxlintrc.json`): the
  folder tree and the shape *inside* each domain folder, colocated tests,
  barrels, bare `fetch`, and hardcoded colours. oxlint has the file open and its
  AST parsed already, so these belong there rather than in a second pass — and
  the agent sees the error at the moment it writes the file.
- **agent-guardrails** (`scripts/guardrails/`) is left with what oxlint never
  sees: per-folder READMEs, a centralized test *directory*, required files,
  config files that shadow each other, banned dependencies in the manifest,
  committed secrets — facts about files and folders the linter is never asked to
  lint — plus **the whole Rust stack**, which oxlint cannot parse at all.

Which side owns what is **declared**, not implied: `ownedByLinter` in
`guardrails.config.json` lists the checks the linter enforces, and the bash
module skips exactly those. The Rust stack lists none. `validate-templates.sh`
fails if a check is declared linter-owned without a matching oxlint rule, so the
two can never both go quiet.

Both read their numbers from **one declaration**, `guardrails.config.json`, and
the kit's own CI asserts that the ceiling declared there matches the one oxlint
and clippy actually enforce. The declaration is the source of truth; the linters
are the enforcers.

`scripts/guardrails/` is copied verbatim from the kit and is not hand-edited —
change `guardrails.config.json` instead. It needs `jq` everywhere, and ast-grep
on **Rust only** (`cargo install ast-grep --locked`), where the pattern rules
have no other enforcer. The TypeScript stacks carry no ast-grep dependency at
all: their pattern rules run inside oxlint.

Two of the gate steps exist to keep the codebase from rotting quietly:

- **knip** (`knip.json`) fails on an unused file, an unused export, or a
  dependency nothing imports. The no-barrel rule is what makes it accurate —
  with no re-export layer to hide behind, an export that nothing uses is
  genuinely dead.
- **jscpd** (`.jscpd.json`) fails on copy-paste. It ships with `"threshold": 0`
  **and `"exitCode": 1`**, and the division of labour between them is worth
  knowing: `threshold: 0` is what fails the gate — any clone exceeds it, so
  jscpd throws and exits 1 (verified on 4.0.0, 4.2.5 and 5.0.14, with and
  without the key). `exitCode: 1` is inert at `threshold: 0`; it earns its place
  only if the threshold is ever raised above the observed duplication, where
  jscpd does not throw and without the key prints the clones and exits 0. Keep
  the pair — it is what stays correct if someone relaxes the threshold. Tests
  are excluded; repeated setup there is not the duplication worth chasing.

The same steps run in CI (`.github/workflows/ci.yml`) on every PR and push to
`main`, **each as its own named step** so a red run names the failing gate
instead of burying it in one aggregate command. CI ends with a real build (or a
dry-run deploy), because a type-clean project can still fail to ship.

**5. AI code review (`.github/workflows/code-review.yml`).** Every stack ships
it. It reviews each PR against the repo's own convention files — read from the
**base** ref, so a PR cannot rewrite the rules it is judged by — and posts inline
findings. It needs a `DEEPSEEK_API_KEY` repository secret.

Both CI and Code Review should be **required checks** on `main`. That is on every
stack's human-only checklist, because only a human can set it.

## Package management

TypeScript stacks use **bun** (install, run, scripts). Rust uses **cargo**.
Lockfiles are committed. CI installs with `--frozen-lockfile`.

Generated files that the type-checker needs on a fresh clone are **committed**,
excluded from lint/format, marked `linguist-generated`, and never hand-edited —
`src/route-tree.gen.ts` (console) and `worker-configuration.d.ts` (backend-ts).
CI regenerates the latter and fails on a diff, so config and types cannot drift.
