# `@toolu/create` setup and compatibility guide

The public initializer is the canonical way to create a Toolu project:

```bash
npx @toolu/create@latest my-project
```

It supports macOS, Linux, and WSL with Node 20.12 or newer. Native Windows and
updating an existing project are not supported. The target directory must not
exist.

## Prerequisites

The initializer verifies its toolchain before creating its staging directory. It
does not install or modify global tools.

- All projects: Node 20.12+, Bun and `bunx`, Git, `jq`, and `ast-grep`.
- Rust projects: Cargo, rustfmt, and Clippy in addition to the shared tools.

Install missing tools using their official instructions, then rerun the same
command. Provider CLIs are installed only by generated project scripts when a
human explicitly runs those scripts later; scaffolding never authenticates.

## Command interface

```text
create-toolu <target> [options]

--config <path>          Replay or extend a toolu.scaffold.json manifest
--stack <id>             console | marketing | backend-ts | expo | rust
--name <name>            Lowercase kebab-case package/project name
--display-name <name>    Human-readable product name
--integration <id>       Add an integration (repeatable)
--operation <id>         Add an operations module (repeatable)
--staging                Include a staging environment
--no-staging             Explicitly omit staging
--theme <preset>         jade | blueprint | ion | chalk
--theme-from <path>      Import compatible tokens and record SHA-256 hashes
--page <slug>            Add a marketing route (repeatable)
--domain <host>          Production domain used by generated metadata
--console-url <url>      Associated console URL
--port <number>          Local service port
```

`--integration`, `--operation`, and `--page` preserve command-line order and may
be repeated. Flags override config values. Optional values not supplied by either
source receive stable defaults. An interactive terminal asks for any missing
required values and presents a review confirmation; non-TTY execution fails once
with the complete missing list (`<target>, --stack, --name`). Ctrl+C exits without
creating a target.

## Stable defaults

- Integrations and operations: none.
- Staging: off.
- Visual theme: Jade.
- Marketing routes: `home`.
- Backend persistence: Turso.
- Backend Drizzle: off.
- Ports: console 5173, marketing 4321, backend 8787, Expo 8081, Rust 3000.
- Display name: title-cased project name.

Direct dependency versions are exact. `bun.lock` or `Cargo.lock` freezes the
resolved transitive dependency graph in the generated project.

## Compatibility matrix

| Stack | Integrations | Operations | Theme |
| --- | --- | --- | --- |
| `console` | `api`, `auth`, `worker-api` | `cloudflare`, `local-dev`; `infisical` requires `worker-api` | preset or compatible web import |
| `marketing` | `blog`, `changelog`, `ssr-cloudflare`, `react-island`, one of `analytics-posthog`, `analytics-plausible`, `analytics-fathom` | `cloudflare`, `local-dev` | preset or compatible web import |
| `backend-ts` | `auth`, `structured-logging`, `drizzle`, `database-package` | `cloudflare`, `infisical`, `local-dev` | none |
| `expo` | `api`, `auth`, `async-storage` | `local-dev` | preset or compatible native import |
| `rust` | `clap`, `axum`, `serde` | `infisical` and `local-dev` require `axum`; Cloudflare is unsupported | none |

`database-package` requires `drizzle` and materializes a Bun workspace with
`packages/api` and `packages/database` from the derived `database-ts` stack.
Turso remains the persistence provider.
Rust CLI projects do not support local-dev operations because the operations
contract requires a long-running Axum service and health probe.

## Operations modules

The `--operation` intake maps stable CLI IDs to the repository-owned modules:

| CLI ID | Convention source | Purpose |
| --- | --- | --- |
| `cloudflare` | `conventions/cloudflare-infra/` | deploy ordering, Worker secret sync, and tunnel ingress/DNS planning |
| `infisical` | `conventions/infisical-secrets/` | machine-identity secret delivery to server-runtime targets |
| `local-dev` | `conventions/local-dev/` | manifest-driven services, fixed ports, probes, and ownership-safe cleanup |

The generator installs the shared operations contract and every selected module
as part of the deterministic recipe. Maintainers changing that routing should
follow [`conventions/SETUP.md`](./conventions/SETUP.md); generated projects do
not need to execute that manual setup guide.

Provider operations (`cloudflare` or `infisical`) use exactly `local`,
`development`, and `production`; they cannot be combined with `--staging`.
Without provider operations, `--staging` adds a real Wrangler or EAS staging
profile as appropriate. Local-dev remains independently selectable.

Marketing page values are `home` or deterministic lowercase route slugs such as
`pricing` and `about/team`. Traversal, empty segments, uppercase characters, and
unstable dynamic routes are rejected.

## Themes

Jade, Blueprint, Ion, and Chalk change the signal-temperature tokens while
preserving component structure. `--theme-from` imports only the finite compatible
token surface:

- web: `palette.css` and `scale.css`;
- native: `colors.ts`, `icons.ts`, `motion.ts`, `spacing.ts`, and `typography.ts`.

The generated manifest records the resolved source and SHA-256 hash for every
file. Replay verifies those hashes before filesystem mutation and fails if a
source changed. Keep the source available or vendor the token directory beside
the replay manifest.

## Deterministic manifests and replay

Every project contains `toolu.scaffold.json` with schema version 1, generator
version, identity, discriminated stack settings, selected integrations and
operations, environments, runtime metadata, theme selection/import hashes, and
recipe IDs. Its public JSON Schema is
[`schemas/toolu.scaffold.schema.json`](./schemas/toolu.scaffold.schema.json).

```bash
npx @toolu/create@latest --config ./toolu.scaffold.json
```

Because targets must be new, use flags to replay into another target when
needed:

```bash
npx @toolu/create@latest new-target \
  --config ./toolu.scaffold.json \
  --name new-target
```

Pre-1.0 replay compatibility is limited to the same generator minor line. A
manifest produced by 0.6.x is accepted by another 0.6.x generator and rejected
by an incompatible line.

## Filesystem and failure behavior

All validation and prerequisite checks happen before mutation. The generator
then authors in a sibling `.<target>.toolu-staging` directory, installs
dependencies, generates runtime types, formats, initializes Git, installs
Lefthook, runs canonical checks/builds and operations validators, and atomically
renames the directory on success.

On failure, the final target remains absent. Staging output is retained with a
mode-0600 `.toolu-failure.json` containing the phase, exit code, redacted bounded
command logs, and safe rerun guidance. Inspect it, then remove or rename that
exact staging directory before retrying. The CLI never creates a remote, pushes,
makes an initial commit, deploys, provisions cloud resources, or signs in.

## Human-only follow-up

After generation, follow the generated README for any selected provider. EAS,
Cloudflare, Turso, Infisical, npm organization administration, provider
authentication, repository secrets, branch protection, and deployment remain
human or CI actions.

## Maintainer release bootstrap

The release workflow publishes `@toolu/create` with provenance using an npm trusted publisher
and keeps the existing GitHub App for changelog and tag pushes.
One-time setup:

1. initially publish or claim public package `@toolu/create` for the `@toolu`
   organization;
2. configure `.github/workflows/release.yml` as the package's npm trusted
   publisher;
3. run a release and verify its provenance attestation; and
4. disable and delete every legacy npm publish token.

Do not add an npm token back to the workflow. Its `id-token: write` permission is
the publication credential.
