# Operations Conventions Implementation Plan

**Goal:** Add composable Cloudflare, Infisical, and local-dev conventions with a shared validated manifest and three reusable project-local skills.

**Architecture:** A shared operations contract is copied once; provider and dev
modules add only their owned scripts and workflows. Offline fixture tests prove
validation, planning, secret filtering, and process-safety behavior.

## Workstreams

1. Add the manifest schema, validator, and fixture harness.
2. Add Infisical atomic download and dotenv helpers with tests.
3. Add Cloudflare tunnel planning and ordered deployment helpers with tests.
4. Add manifest-driven local supervision and ownership-safe port handling with
   tests.
5. Add module setup docs, router intake, skills, and kit-level validation.
6. Run all convention and existing guardrail/template gates, then commit, push,
   and open a draft PR against `main`.

## Global constraints

- Environments are exactly `local`, `development`, and `production`.
- Local dev works without either provider; adapters activate when configured.
- Skills and dry runs do not mutate provider state.
- Generated code is Bash 3.2 compatible where practical and requires `jq` for
  manifest parsing.
- toolu.sh-specific maintenance scripts stay out of scope.
