//! Startup greeting helper for the skeleton binary.

/// Builds the greeting shown at startup.
pub(crate) fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
#[path = "tests/greeting.rs"]
mod tests;
