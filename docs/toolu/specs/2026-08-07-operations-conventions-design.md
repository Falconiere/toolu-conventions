# Operations conventions — Design

**Date:** 2026-08-07
**Status:** Approved
**Topic:** Extract Cloudflare infrastructure, Infisical secrets, and local-development operations into reusable convention modules and project-local skills.

## Problem

The operational scripts in `toolu.sh` encode useful behavior, but they are tied
to one workspace, its ports, domains, Worker names, and deployment commands.
Copying them into every stack would create several sources of truth. The kit
needs composable modules whose configuration is project data rather than shell
constants.

## Architecture

Three opt-in modules live under `conventions/`: `cloudflare-infra`,
`infisical-secrets`, and `local-dev`. They copy focused helpers into
`scripts/operations/` and share one root `operations.config.json`. Local dev is
independent; it activates Cloudflare tunnel and Infisical refresh adapters only
when those provider sections are configured.

The environment contract is exactly `local`, `development`, and `production`.
Cloudflare supports console, marketing, backend-ts, and compatible workspaces.
Infisical supports server/runtime projects: backend-ts, Rust services,
workspaces, and console projects with a same-project Worker API.

## Safety boundaries

- Skills scaffold, merge, inspect, and dry-run repository configuration. They
  never deploy or mutate provider accounts.
- Tunnel reconciliation is a read-only plan unless a human runs the generated
  command with `--apply`.
- Secret downloads use machine identity, restrictive temporary files, safe
  dotenv parsing, and atomic replacement. Client/static targets are rejected.
- Local dev stops only processes recorded as belonging to its previous run. A
  foreign listener is reported and never signalled.
- Deploy order is secrets, validation, configured migration/check, filtered
  Worker secret sync, then code deployment.

## Distribution

Each module has an executable `SETUP.md`, templates, and offline fixtures.
Canonical skills live under `skills/` and selected skills are copied unchanged
to `.agents/skills/` in generated projects. Existing stack behavior remains
unchanged when no operations module is selected.

## Non-goals

- No change to `/root/projects/toolu.sh`; it is reference material only.
- No migration of design checks, token checks, publishing, or namespace smoke
  scripts.
- No automatic account, token, DNS, tunnel, or secret creation.
- No Infisical export into Expo, static marketing, or browser-only bundles.
