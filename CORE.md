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

Four layers. A project is only correct when all four are green, and **none of
them may be disabled to get there** — not for an unrelated failure, not "just
this once". If a check is wrong, fix the check deliberately and say so; don't
route around it.

**1. The rules, in the repo.** Every generated project ships a `CLAUDE.md` (from
the stack kit's `CLAUDE.md.template`) — the agent's read-first file, encoding
these core rules, the stack's hard conventions and blocked patterns, a repo map,
and the exact gate commands. Rules an agent can't see are rules that don't exist.

**2. Pre-commit (Lefthook), on every stack including Rust.** Fast staged-file
checks only — format + lint. Config must be `lefthook.yml`; a `lefthook.yaml` is
silently shadowed by the 2.x installer's stub, and the hooks then never run.

**3. The gate — ONE command, run before every push.**

- **TypeScript stacks** — `bun run check` =
  type-check + `bunx oxlint --deny-warnings` + `bunx oxfmt --check` +
  `bash scripts/check-structure.sh` + `bunx knip` + `bunx jscpd` + the test
  runner, in that order. ("Type-check" is `tsc --noEmit`, except in the marketing
  stack, where it is `astro check` — the only tool that reads an `.astro`
  file's TEMPLATE body. oxlint reads its frontmatter too; oxfmt cannot parse
  `.astro` at all.)
- **Rust** —
  `cargo fmt --check && cargo clippy --all-targets -- -D warnings && bash scripts/check-structure.sh && cargo test`.

Structure rules are machine-enforced, not doc-only: oxlint carries
`no-restricted-imports` (no barrel imports, no deep relatives, feature
isolation, **no axios**, no competing validation library),
`import/no-default-export`, `unicorn/filename-case`
(kebab-case), and `max-lines` (300, code lines, tests exempt); each stack ships a
small `scripts/check-structure.sh` that checks what a linter cannot see — the
folder tree, per-folder READMEs, absence of barrel files, banned dependencies in
`package.json`, config files that shadow each other, and committed secrets.

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

**4. AI code review (`.github/workflows/code-review.yml`).** Every stack ships
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
