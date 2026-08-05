//! Binary entry point for `project-name`.
//!
//! This is a starter skeleton: replace it with the real program. It exists so
//! the toolchain, lints, and test harness are wired and green from commit one.

mod greeting;

use greeting::greeting;

/// Program entry point.
fn main() {
    println!("{}", greeting("world"));
}
