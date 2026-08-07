# SETUP — Local Development

Use for a single service or workspace. This module reads service commands,
ports, and health probes from `operations.config.json`; it has no hard-coded
application topology and no mandatory provider.

## Install

1. Complete [`../SETUP.md`](../SETUP.md)'s shared-contract steps.
2. Copy `templates/scripts/operations/dev/` to `scripts/operations/dev/` and
   make each `.sh` executable.
3. Add every local service with a unique name, runtime classification, command,
   and fixed port. Add an HTTP health probe wherever the service exposes one.
   Commands are whitespace-separated executables and arguments, executed
   directly without a shell. Shell operators, expansion, quoting, and
   redirection are rejected. Put complex composition in a reviewed
   repository-owned package script or executable.
4. Add `.tooling/operations/` to `.gitignore`.
5. Copy `skills/manage-local-dev/` from the kit to
   `.agents/skills/manage-local-dev/` unchanged.

For a `package.json` project, point its top-level `dev` or `dev:stack` command
at `scripts/operations/dev/start.sh`. Keep individual service commands under
their own names so the manifest can invoke them without recursion.

## Verify

```bash
scripts/operations/validate-config.sh operations.config.json
scripts/operations/dev/preflight.sh --check-config
bash -n scripts/operations/dev/*.sh
```

To install missing Infisical/cloudflared binaries into the project-local
`.tooling/bin` using the module's pinned checksums, run
`scripts/operations/dev/preflight.sh --install`. Runtime/package-manager
installation remains a human choice.

## Human-only checklist

- Install any missing runtime or provider CLI named by preflight.
- Confirm every configured port is intentional and currently free.
- If Cloudflare is selected, review tunnel drift before applying it.
- If Infisical is selected, perform the first local secret download.
