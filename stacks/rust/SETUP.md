# Rust — Setup

Scaffold a single-crate Rust project that is green under the house gate from the
first commit. Follow this file top to bottom. It inherits every rule in
[`../../CORE.md`](../../CORE.md); read that first if you haven't.

Scope: **one crate, no workspace** (Cargo workspaces are out of scope for v1).
There is **no staging-environment question for Rust** — skip it.

Throughout, two shell variables stand in for your inputs — set them once:

```bash
KIT=/path/to/toolu-convensions          # this kit's checkout
PROJECT=project-name                      # kebab-case name from intake
```

## 0. Prerequisites

```bash
cargo --version        # need cargo + rustc (stable). Install via https://rustup.rs
rustfmt --version      # ships with rustup; `rustup component add rustfmt` if missing
cargo clippy --version # `rustup component add clippy` if missing
```

Lefthook is a standalone binary — install it once (macOS, the exact instruction
for this kit):

```bash
brew install lefthook
```

(No Homebrew? Use the no-install path in step 4: `bunx lefthook install`.)

## 1. Create the crate

```bash
cargo init --name "$PROJECT" "$PROJECT"
cd "$PROJECT"
```

`cargo init` writes a starter `Cargo.toml`, `src/main.rs`, `.gitignore`, and
initializes git. The next step overwrites the manifest and entry point with the
kit's templates.

## 2. Copy templates

Copy each template to its destination (source → destination). `CLAUDE.md.template`
is renamed to `CLAUDE.md`; everything else keeps its name.

```bash
cp "$KIT/stacks/rust/templates/Cargo.toml"            Cargo.toml
cp "$KIT/stacks/rust/templates/rustfmt.toml"          rustfmt.toml
cp "$KIT/stacks/rust/templates/lefthook.yml"          lefthook.yml
cp "$KIT/stacks/rust/templates/src/main.rs"           src/main.rs
cp "$KIT/stacks/rust/templates/README.md"             README.md
cp "$KIT/stacks/rust/templates/CLAUDE.md.template"    CLAUDE.md

mkdir -p scripts
cp "$KIT/stacks/rust/templates/scripts/check-structure.sh" scripts/check-structure.sh
chmod +x scripts/check-structure.sh

mkdir -p .github/workflows
cp "$KIT/stacks/rust/templates/.github/workflows/ci.yml" .github/workflows/ci.yml
```

Then set the crate name in the copied manifest and `CLAUDE.md` (the templates
ship the literal placeholder `project-name`):

```bash
# macOS / BSD sed. On Linux or CI, drop the '' after -i.
sed -i '' "s|^name = .*|name = \"$PROJECT\"|" Cargo.toml
sed -i '' "s|project-name|$PROJECT|g" src/main.rs CLAUDE.md README.md
```

`templates/folder-README.md` is a template you copy **into a `src/` submodule
folder only when that module grows past one file** — not into the project root
now.

## 3. Source layout

Follow [`STRUCTURE.md`](./STRUCTURE.md). In short:

- `src/main.rs` for a binary (or `src/lib.rs` for a library; both for a binary
  with testable/reusable logic).
- One module per responsibility, `snake_case` filename named after its primary
  item (`shift_store.rs` → `struct ShiftStore`).
- **No `mod.rs` barrels** — declare submodules from the parent file. When `foo.rs`
  grows into a folder, keep `src/foo.rs` beside `src/foo/`.
- Unit tests in-file under `#[cfg(test)] mod tests`; integration tests in the
  sibling top-level `tests/` directory, one file per surface. Real data, no mocks.

## 4. Install git hooks

`lefthook.yml` must already be in place from step 2 **before** you run `install`
— lefthook 2.x writes a starter `lefthook.yml` stub when it finds no config, and
a stub would shadow the real one. You copied it in step 2, so just install:

```bash
lefthook install
```

No Homebrew / prefer not to install a system binary? Use bun instead — it fetches
lefthook on demand:

```bash
bunx lefthook install
```

Either way this wires `pre-commit` (fmt) and `pre-push` (clippy) from
`lefthook.yml`. If a stray `lefthook.yaml` exists alongside it, delete it — the
`.yml` name is the one lefthook writes and reads by default.

## 5. Optional integrations (opt-in)

Only wire what the project asked for at intake. Each is one `cargo add` plus where
the code goes. Nothing here is in the skeleton.

- **CLI parsing — `clap`.** For a binary with flags/subcommands.
  ```bash
  cargo add clap --features derive
  ```
  Put the arg definition in `src/cli.rs` as a `#[derive(Parser)] struct Cli`;
  call `Cli::parse()` at the top of `main`.

- **HTTP service — `axum` + `tokio`.** For a network service.
  ```bash
  cargo add axum
  cargo add tokio --features full
  ```
  Put the router/handlers in `src/http/` (e.g. `src/http/router.rs`, one file per
  route group); make `main` async with `#[tokio::main]`. Trim `tokio`'s `full`
  feature set later if you only need a subset.

- **Serialization — `serde` / `serde_json`.** For JSON/config/wire formats.
  ```bash
  cargo add serde --features derive
  cargo add serde_json
  ```
  Derive `Serialize`/`Deserialize` on the domain types in their own module (swap
  `serde_json` for `toml`/`serde_yaml` if that's the format).

For error handling in any of the above, add `thiserror` (library error enums) or
`anyhow` (binary top level) — see [`LIBRARIES.md`](./LIBRARIES.md).

## 6. Run the gate

This is the one command that must be green before the scaffold is done — the same
sequence CI and the pre-push hook run:

```bash
cargo fmt --check && cargo clippy --all-targets -- -D warnings && bash scripts/check-structure.sh && cargo test
```

`-D warnings` promotes every clippy `warn` (pedantic group, `missing_docs`,
`unwrap_used`/`expect_used`) to a hard error. `scripts/check-structure.sh`
enforces the structure rules the compiler can't see — snake_case `.rs` filenames,
the 500 code-line ceiling (tests exempt), and that the lefthook config is `.yml`.
Fix the code; never silence a lint to pass. The freshly scaffolded skeleton passes
this as-is.

Commit once it's green.

## 7. Human-only checklist

Print this and stop — these need a human:

- [ ] **Publishing to crates.io?** Only if this crate is meant to be published:
      create the crates.io account, run `cargo login <token>`, and set `[package]`
      `license`, `description`, and `repository` in `Cargo.toml` before
      `cargo publish`. Skip entirely for a private/app binary.
- [ ] **Deploy target.** If this is a service/binary that ships somewhere (a
      container, a host, a release artifact), set that up — it is not part of the
      scaffold.
- [ ] **CI secrets.** Add any registry or deploy credentials the GitHub Actions
      workflow needs as repository secrets.
