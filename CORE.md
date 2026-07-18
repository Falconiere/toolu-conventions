# Core Conventions

Stack-agnostic house rules. Every stack kit under `stacks/` inherits these; a
stack's `STRUCTURE.md` may add rules but never relax one. Agents scaffolding a
project read this file first, then the chosen stack kit.

## Hard rules

1. **No barrel files.** Never create an `index.ts(x)` / `mod.rs` whose only job
   is re-exporting. Import the concrete file that holds the thing. Every symbol
   stays traceable to exactly one file — the single most useful property for an
   agent navigating a repo. Sanctioned exception: framework ROUTE files
   (`app/**` in Expo Router, `src/app/**` in Next.js) — they exist to re-export
   a feature screen and are the only place default exports are allowed.
2. **Filename ↔ content.** Kebab-case filenames (Rust: snake_case per language
   norm); the file is named after its primary export (`shift-card.tsx` →
   `ShiftCard`, `use-shifts.ts` → `useShifts`). One primary export per file.
3. **One responsibility per file.** A file does one thing. Flat until it grows:
   keep a unit as a single file until it passes the size ceiling or sprouts
   sub-parts, then promote it to a folder.
4. **Size ceilings.** Max **300 code lines per TypeScript file**, **500 per Rust
   file** (blanks/comments excluded; tests exempt). If a design implies a bigger
   file, split the design — don't fight the gate later.
5. **Tests colocate.** TypeScript: sibling `__tests__/` folder
   (`button.tsx` → `__tests__/button.test.tsx`). Rust: sibling `tests/` (unit
   tests may live in-file under `#[cfg(test)]`). Keep test trees flat.
6. **Real data, no mock-data tests.** Tests exercise real inputs and real
   integration paths. A test that only proves a mock returns what the mock was
   told to return is banned — it hides integration breakage.
7. **Doc line required.** Every module and public symbol carries a concise doc
   line (TS: leading `/** … */` one-liner; Rust: `///`). Brief, but not
   optional.
8. **Docs in sync.** A change that touches a user-facing surface (behavior,
   public API, CLI flags, commands, config) updates the prose that describes it
   — README, guides, release notes — in the same change.
9. **No `any`.** No `as any`, `: any`, `as unknown as T`. Use `unknown` + type
   guards. Rust equivalent: no `unwrap()`/`expect()` outside tests and `main`
   bootstrap — propagate errors.
10. **No `console.log` / `debugger`** in committed code. Use
    `console.warn`/`console.error` (TS) or a logger. Rust: no stray `println!`
    debugging — use `eprintln!`/`tracing`.

## Quality gate

Never advance while any error, warning, or test failure stands — even an
unrelated one. Every stack wires its gate as ONE command:

- **TypeScript stacks** — `bun run check` =
  `bunx tsc --noEmit` + `bunx oxlint --deny-warnings` + `bunx oxfmt --check` +
  `bash scripts/check-structure.sh` + the stack's test runner (`bun run test`).
- **Rust** —
  `cargo fmt --check && cargo clippy --all-targets -- -D warnings && bash scripts/check-structure.sh && cargo test`.

Structure rules are machine-enforced, not doc-only: oxlint carries
`no-restricted-imports` (no barrel imports, no deep relatives, feature
isolation), `unicorn/filename-case` (kebab-case), and `max-lines` (300, code
lines, tests exempt); each stack ships a small `scripts/check-structure.sh`
that checks the folder tree itself (allowed directories, per-folder READMEs,
no barrel files, and — rust — the 500 code-line ceiling).

Pre-commit hooks run via **Lefthook** on every stack, Rust included — fast
staged-file checks only (format + lint); the full gate belongs to CI and to the
one command above.

## CLAUDE.md contract

Every generated project ships a `CLAUDE.md` (from the stack kit's
`CLAUDE.md.template`). It is the agent's read-first file and must encode: these
core rules, the stack's hard conventions and blocked patterns, a repo map, and
the exact gate commands.

## Package management

TypeScript stacks use **bun** (install, run, scripts). Rust uses **cargo**.
Lockfiles are committed. CI installs with `--frozen-lockfile`.
