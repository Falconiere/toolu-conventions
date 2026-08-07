# No Dead Code — Design

**Date:** 2026-08-07  
**Status:** Approved for implementation

## Goal

Every generated Rust and TypeScript project must reject dead code. Developers
delete unused code or connect it to a real entry point; they do not rename it to
an ignored form or silence the diagnostic.

## Enforcement

### Rust

Set `dead_code = "forbid"` in the Rust template's `[lints.rust]` table. Although
the policy is commonly described as “deny dead code,” Rust's `deny` level can be
lowered by `#![allow(dead_code)]`. `forbid` is required to make that attribute a
compiler error and therefore satisfies the no-suppression requirement.

The existing `cargo clippy --all-targets -- -D warnings` gate remains in place
for the rest of the warning surface.

### TypeScript

Keep all three existing layers because they detect different forms of dead
code:

- TypeScript's `noUnusedLocals` and `noUnusedParameters` detect unused local
  declarations and parameters.
- Oxlint's `typescript/no-unused-vars` catches the same issue during lint and
  closes TypeScript's leading-underscore parameter exemption.
- Knip detects unused files, exports, dependencies, and other project-graph
  issues that a per-file compiler or linter cannot see.

Remove the `argsIgnorePattern` and `varsIgnorePattern` leading-underscore
exemptions from the canonical Oxlint base and propagate that byte-identical base
to every TypeScript stack.

Add an independent guardrail for source comments that disable the unused-code
lint, including blanket Oxlint disable directives. It must reject only active
lint directives, not documentation that discusses them. This check cannot be
implemented as another Oxlint rule because the same directive could disable
that rule too.

Existing Knip entries and narrowly documented ignores for framework-generated
or non-TypeScript-consumed assets remain valid: an entry point or a tool
visibility boundary is not dead code. New ignores must not be presented as the
remedy for a genuine unused-code finding.

## Validation

Tests and template validation will prove the policy rather than only inspecting
configuration text:

- A Rust probe containing `#![allow(dead_code)]` fails under the shipped lint
  level.
- TypeScript with an unused underscore-prefixed declaration fails the shipped
  Oxlint configuration.
- TypeScript source that disables the unused-variable rule, or uses a blanket
  Oxlint disable directive, fails the independent guardrail.
- Clean fixtures and the freshly materialized templates continue to pass.
- Template validation asserts that all TypeScript stacks retain
  `noUnusedLocals`, `noUnusedParameters`, the canonical Oxlint base, and Knip in
  the full gate.

Implementation follows test-first development: each missing behavior is first
demonstrated by a failing focused test, followed by the smallest enforcement
change that makes it pass.

## Documentation

After implementation, audit `CORE.md`, each Rust and TypeScript stack's
`STRUCTURE.md`, `SETUP.md`, `LIBRARIES.md`, and generated `CLAUDE.md` guidance.
Update every statement affected by the new enforcement, including:

- Rust uses `forbid`, not a warning promoted only by `-D warnings`.
- Leading underscores are not an accepted TypeScript unused-code escape hatch.
- Dead code is deleted or wired into a real entry point, never suppressed.
- Knip remains responsible for graph-level dead code and its legitimate
  framework/tool boundaries stay documented.

The documentation audit must also search for stale or contradictory claims and
confirm that commands, lint names, and ownership descriptions match the files
that actually enforce them.

## Delivery

Run focused regression tests, the guardrails suites, and full template
validation. Review the final diff and documentation search results, commit the
implementation intentionally, push a feature branch, and open a draft pull
request. Monitor required checks and review feedback until the pull request is
green and has no actionable unresolved feedback; fix in-scope failures and
continue monitoring after each update.

## Non-goals

- Removing parameters required by an external interface when TypeScript and
  Oxlint correctly recognize them as used or required.
- Treating generated files or framework-discovered entry points as unused when
  Knip needs explicit configuration to discover them.
- Banning all lint suppressions unrelated to dead code.
