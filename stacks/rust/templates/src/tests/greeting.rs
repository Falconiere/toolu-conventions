#![allow(clippy::unwrap_used, clippy::expect_used)]

use super::greeting;

#[test]
fn greeting_includes_the_name() {
    assert_eq!(greeting("Ada"), "Hello, Ada!");
}
