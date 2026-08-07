# SETUP — Cloudflare Infrastructure

Use for `console`, `marketing`, `backend-ts`, or compatible workspace projects.
The module owns deployment orchestration and local tunnel reconciliation; it
does not replace stack-owned application bindings in `wrangler.jsonc`.

## Install

1. Complete [`../SETUP.md`](../SETUP.md)'s shared-contract steps.
2. Copy `templates/scripts/operations/cloudflare/` to
   `scripts/operations/cloudflare/` and make each `.sh` executable.
3. Merge the two names from `templates/.env.operations.example` into the
   project's `.env.example`. Never overwrite unrelated example entries.
4. Copy both workflows from `templates/.github/workflows/` into the generated
   project's `.github/workflows/`.
   `install-cli.sh` owns the cloudflared version and checksums; do not duplicate
   them in CI or another module.
5. Use `templates/operations.cloudflare.example.json` as the exact shape to
   merge into `operations.config.json`: merge its `cloudflare` object at the
   root and its `serviceFields` into each tunnelled service, then discard the
   example-only `serviceFields` wrapper. Configure optional migration/check
   commands only where that environment actually needs them.
6. Merge `templates/wrangler.operations.example.jsonc` into the stack's
   `wrangler.jsonc`. Keep the stack's `main`, assets, compatibility, bindings,
   and observability settings. Wrangler bindings and vars are non-inheritable,
   so repeat every required binding under both deployed environments; the
   top-level config is local-only and must not be deployed.
7. Copy `skills/manage-cloudflare-infra/` from the kit to
   `.agents/skills/manage-cloudflare-infra/` unchanged.

For a `package.json` project, add convenience commands that delegate to the
shared scripts: `deploy:development`, `deploy:production`, `tunnel:check`, and
`tunnel:apply`. Do not duplicate their logic in JSON or workflow YAML.

## Verify

```bash
scripts/operations/validate-config.sh operations.config.json
scripts/operations/cloudflare/deploy.sh --env development --plan
scripts/operations/cloudflare/deploy.sh --env production --plan
bash -n scripts/operations/cloudflare/*.sh
bunx wrangler deploy --dry-run
```

## Human-only checklist

- Create or select the Cloudflare API token and account.
- Create the named tunnel and review `tunnel.sh --check` before any `--apply`.
- Confirm Worker custom domains and TLS.
- Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to CI secrets.
- Trigger the first development and production deployments manually.
