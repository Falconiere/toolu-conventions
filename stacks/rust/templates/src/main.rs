//! Binary entry point for `project-name`.
//!
//! This is a starter skeleton: replace it with the real program. It exists so
//! the toolchain, lints, and test harness are wired and green from commit one.

/// Builds the greeting shown at startup.
fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

/// Program entry point.
fn main() {
    println!("{}", greeting("world"));
}

#[cfg(test)]
mod tests {
    use super::greeting;

    #[test]
    fn greeting_includes_the_name() {
        assert_eq!(greeting("Ada"), "Hello, Ada!");
    }
}
