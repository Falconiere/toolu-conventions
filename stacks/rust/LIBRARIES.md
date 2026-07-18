# Library Reference

The curated toolbox for Rust projects in this kit. The philosophy is **lean**:
the skeleton ships with **zero dependencies**, and every crate you add must earn
its place — do one job well, and not duplicate the standard library. Reach for
`std` first (it is large and excellent) before adding anything here.

Add a dependency with **`cargo add <crate>`** (it resolves the current version
and writes `Cargo.toml` for you). Commit `Cargo.lock`.

---

## Baseline — what the skeleton ships with

Nothing. The generated crate has an empty `[dependencies]` table so it builds and
lints offline. The only tooling is the toolchain itself and git hooks:

| Concern | Tool | Notes |
| --- | --- | --- |
| Build / test / run | `cargo` | The one entry point for everything. |
| Format | `rustfmt` (`cargo fmt`) | Config in `rustfmt.toml`, stable options only. |
| Lint | `clippy` (`cargo clippy`) | House lint set in the `[lints]` table; CI runs `-D warnings`. |
| Git hooks | `lefthook` | Pre-commit fmt, pre-push clippy. Standalone binary. |

---

## Reach-for-these — add when the project needs them

The approved choice for each job. The opt-in integrations (clap, axum+tokio,
serde) are offered at setup time; add the rest as features demand.

| Concern | Crate | When / why |
| --- | --- | --- |
| CLI arg parsing | **`clap`** (derive feature) | Any binary with flags/subcommands. Derive a struct with `#[derive(Parser)]` — typed, self-documenting, generates `--help`. |
| Async runtime | **`tokio`** | Needed for async I/O (a network service, concurrent tasks). Don't pull it in for a synchronous CLI. |
| HTTP service | **`axum`** (+ `tokio`) | The web framework for this kit. Tower-based, ergonomic extractors, integrates with `tracing`. One HTTP framework per project — see AVOID. |
| (De)serialization | **`serde`** (+ `serde_json`) | JSON/config/wire formats. `#[derive(Serialize, Deserialize)]`. `serde_json` for JSON; swap the format crate (`toml`, `serde_yaml`) as needed. |
| Library error types | **`thiserror`** | Errors in a library crate or shared module. Derive an `enum` error with `#[derive(thiserror::Error)]` — typed, matchable variants for callers. |
| Binary / app errors | **`anyhow`** | The top level of a binary (`main`, request handlers), where you want context-rich errors without enumerating every variant. `anyhow::Result<T>` + `.context(...)`. Do **not** expose `anyhow::Error` from a library's public API — use `thiserror` there. |
| Structured logging / tracing | **`tracing`** (+ `tracing-subscriber`) | Diagnostics and spans. Replaces every debugging `println!`/`eprintln!`. |
| TLS | **`rustls`** | When you need TLS (HTTPS client/server). Pure Rust, no system OpenSSL to fight in CI/containers. |
| Snapshot testing | **`insta`** *(opt-in)* | Tests whose expected value is a large structured output (rendered text, serialized JSON). `assert_yaml_snapshot!` / `assert_snapshot!` review workflow. Still real data — snapshot the real output, don't fabricate it. |

> **thiserror vs anyhow** — the one-line rule: `thiserror` for the errors a
> **library** returns (callers match on them), `anyhow` for the errors a
> **binary** reports (it just needs a message + context). A crate that is both
> uses `thiserror` internally and `anyhow` at the `main` boundary.

---

## AVOID — and why

Don't add these without an explicit, documented reason.

| Crate | Avoid because | Use instead |
| --- | --- | --- |
| `failure` | Unmaintained/dead; predates the `std::error::Error` improvements it worked around. | `thiserror` (libs) / `anyhow` (bins). |
| `error-chain` | Dead; superseded years ago; macro-heavy. | `thiserror` / `anyhow`. |
| `rocket` (when axum is chosen) | Two web frameworks in one project fragments the middleware/extractor model and doubles the async surface. Pick one. | `axum` (this kit's choice). |
| `openssl` (when rustls works) | Drags in a system C library — a recurring source of build/CI/container breakage and cross-compilation pain. | `rustls` (pure Rust). Only reach for `openssl` when a dependency hard-requires it. |
| `lazy_static` / `once_cell` for new statics | The language now covers the common cases. | `std::sync::LazyLock` / `OnceLock` (stable). |
| A second serialization stack next to `serde` | Parallel derive systems and type mappings to maintain. | `serde` + the right format crate. |

---

## Prefer `std` first

Before adding a crate, check whether `std` already does it: `LazyLock`/`OnceLock`
(lazy statics), `std::sync::mpsc` and threads (simple concurrency without an async
runtime), `std::fs`/`std::io` (files), `Duration`/`Instant` (time). A dependency
you don't add is one you never have to audit, update, or explain.
