# Project Structure & Conventions

The canonical layout for a single-crate Rust project in this kit. It inherits
every rule in [`../../CORE.md`](../../CORE.md) and adds the Rust-specific shape.
The design goals are the same as every stack here: **clean iteration** and **easy
LLM traversal** — predictable module names, no barrel modules (every import points
at the file that holds the item), one responsibility per file.

Scope is deliberately narrow: **one crate, one `Cargo.toml`, no workspace.**
Cargo workspaces are out of scope for v1 — if a project outgrows a single crate,
that is a design conversation, not a default.

## Folder tree

```
project-name/
├── Cargo.toml            # crate manifest + [lints] table (the house lint set)
├── Cargo.lock            # committed — CI builds with --locked
├── rustfmt.toml          # formatting config (stable options only)
├── lefthook.yml          # pre-commit fmt · pre-push clippy
├── src/
│   ├── main.rs           # binary entry point …
│   │                     #   (or lib.rs if this crate is a library)
│   ├── <module>.rs       # one module per responsibility, snake_case
│   ├── tests/            # colocated module tests (sibling; not __tests__)
│   │   └── <module>.rs
│   └── <module>/         # a module that outgrew one file becomes a folder:
│       ├── <part>.rs     #   sub-parts declared from <module>.rs
│       └── tests/        #   colocated tests for those parts
│           └── <part>.rs
├── tests/                # crate-root integration tests — one file per surface
│   └── <surface>.rs
├── scripts/
│   └── check-structure.sh # structure gate: snake_case, 500-line ceiling, .yml
├── .github/workflows/ci.yml
├── CLAUDE.md             # agent rules + repo map (read first)
└── README.md             # human + agent entry point
```

A binary crate has `src/main.rs`; a library crate has `src/lib.rs`. A crate can
have both (a thin `main.rs` that calls into `lib.rs`) — do that when the logic
should also be testable/usable as a library.

## Modules — no `mod.rs` barrels

Rust's module tree is declared, not inferred, so it is easy to accidentally build
a barrel. Don't. Concretely:

- **Declare submodules from the parent file**, not from a `mod.rs`. When `foo.rs`
  grows into a folder, keep the file next to the folder: `src/foo.rs` declares
  `mod bar;`, and `src/foo/bar.rs` holds it. (This is the modern path style — no
  `src/foo/mod.rs`.)
- A module file whose only content is `pub use other::Thing;` re-exports is a
  barrel — banned. Import the concrete path (`crate::store::ShiftStore`) at the
  use site instead.
- `pub use` is allowed only to shape a **library's public API** at the crate root
  (`lib.rs`) — the one place a curated facade is legitimate. Everywhere internal,
  import the real path.

## Filename ↔ content

`snake_case` filenames, each named after the file's **primary item**:

| File | Holds |
| --- | --- |
| `shift_store.rs` | `struct ShiftStore` (+ its `impl`) |
| `parse_config.rs` | `fn parse_config` |
| `shift.rs` | `struct Shift` / `enum Shift` — the domain type |

One primary item per file. Small tightly-coupled helpers can share the file with
the item they serve; a second unrelated public type means a second file.

`scripts/check-structure.sh` enforces the `snake_case` filename rule (every `.rs`
under `src/`/`tests/` must match `^[a-z0-9_]+\.rs$`) as part of the gate.

## Tests

**Tests never share a file with production logic.** No in-file
`#[cfg(test)] mod tests { … }` bodies. Same idea as TypeScript’s `__tests__/`,
with the Rust folder name `tests/`. Real data only — no mock-data tests.

### Colocated module tests — sibling `tests/`

```
src/
├── parse_config.rs              # production module
├── tests/
│   └── parse_config.rs          # colocated tests (sibling tests/ folder)
├── shift_store.rs               # module root (declares submodules)
└── shift_store/
    ├── query.rs
    └── tests/
        └── query.rs             # colocated next to the part under test
```

Keep each `tests/` tree **flat**. Filename matches the module under test.

The production file may include the test module with a **one-line** path include
so unit tests can `use super::*` and reach private items — the test *code* still
lives in the sibling file:

```rust
#[cfg(test)]
#[path = "tests/parse_config.rs"]
mod tests;
```

`scripts/check-structure.sh` fails the gate if a non-`tests/` `.rs` file contains
an inline `#[cfg(test)] mod … {` body.

### Crate-root integration tests

Integration tests live in the **top-level** `tests/` directory (sibling of
`src/`), one file per public surface (`tests/cli.rs`, `tests/http_api.rs`). Each
file is its own crate that exercises the public API the way a real consumer
would.

Tests are exempt from the line ceiling.

## Hard conventions

Inherited from CORE, stated here in Rust terms — enforced by the `[lints]` table,
`scripts/check-structure.sh`, and Lefthook:

1. **500 code-line ceiling per file** (blanks/comments excluded; tests exempt) —
   script-enforced by `scripts/check-structure.sh` in the gate. Split the design
   before you fight the gate.
2. **Doc line on every public item and module.** `///` on every `pub` fn, struct,
   enum, trait, and field; `//!` at the top of each module. `missing_docs = warn`
   plus `-D warnings` makes an undocumented public item a CI failure.
3. **No `unwrap()` / `expect()` outside tests and the `main` bootstrap.** Return
   `Result` and propagate with `?`. `clippy::unwrap_used` / `expect_used` enforce
   it; the only exemptions are colocated/crate-root test modules (with an
   explicit `#[allow(...)]`) and fail-fast startup.
4. **No `unsafe`.** `unsafe_code = "forbid"`.
5. **No stray `println!` debugging** — `println!` is for real program stdout;
   diagnostics go through `eprintln!` or `tracing`.
6. **Prefer fallible conversions.** No silent truncating `as` casts — use
   `TryFrom`/`try_into` and handle the error (pedantic clippy flags the risky
   casts).
7. **Docs in sync.** Touch a user-facing surface (CLI flags, public API, config),
   update the prose describing it (`README.md`, `CLAUDE.md`) in the same change.

## LLM-indexability strategy

An agent should answer "where does X live / is there already a helper for Y?"
without reading the whole tree. That comes from:

- **No barrels + filename ↔ content** — grep/`ast-grep` for a symbol lands on its
  one definition immediately.
- **`CLAUDE.md` at the root** — the map + rulebook, read first.
- **A `README.md` in any `src/` submodule folder that grows** (use
  [`templates/folder-README.md`](./templates/folder-README.md)): what belongs
  there, what's inside (one line each), and where NOT to put things. Add a line
  when you add a file.
