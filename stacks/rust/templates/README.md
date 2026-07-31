# project-name

<One-sentence description of what this crate does.>

## Requirements

- Rust (stable) with `cargo`, `rustfmt`, `clippy` — install via [rustup](https://rustup.rs).

## Develop

```bash
cargo run            # run the binary
cargo test           # run the test suite
```

## Quality gate

Everything must be green before a change is done. This is the same command CI
runs:

```bash
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Git hooks (via [Lefthook](https://lefthook.dev)) run `cargo fmt --check` on
commit and clippy on push. Install them once after cloning:

```bash
lefthook install
```

## Layout

- `src/` — one module per responsibility, `snake_case` filenames.
- `src/**/tests/` — colocated module tests (sibling `tests/` folders; never in-file).
- `tests/` — crate-root integration tests, one file per surface.
- `CLAUDE.md` — conventions and blocked patterns (read first if you are an agent).

## Conventions

See [`CLAUDE.md`](./CLAUDE.md). The short version: no barrel modules, filename
matches its primary item, no `unwrap()`/`expect()` outside tests and `main`, a
doc line on every public item, real-data tests only, 500-line file ceiling.
