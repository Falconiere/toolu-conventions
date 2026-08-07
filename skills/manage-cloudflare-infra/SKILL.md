---
name: manage-cloudflare-infra
description: Use when configuring or maintaining Cloudflare Workers, Wrangler environments, deployment workflows, Worker secret synchronization, local tunnels, ingress, or DNS in a project that uses operations.config.json.
---

# Manage Cloudflare Infra

Keep repository configuration, deployment order, and tunnel routes consistent
with the project's operations manifest. Treat live Cloudflare changes as a
human/CI boundary.

## Workflow

1. Read `operations.config.json`, `wrangler.jsonc`, relevant package scripts,
   and `scripts/operations/cloudflare/` before proposing changes.
2. Require exactly `local`, `development`, and `production`. `local` has no
   deployed Worker; never add a staging alias.
3. Edit the manifest first, then update only the repository artifacts that must
   agree with it. Preserve unrelated Wrangler bindings, routes, and settings.
   Repeat vars and bindings under `development` and `production`; Wrangler does
   not inherit them into named environments.
4. Keep deploy order: fetch secrets, validate the target, run configured
   migration/check commands, filter bootstrap credentials, sync Worker secrets,
   then deploy code.
5. Run the checks below. Report live-account actions as a human checklist; do
   not run deployment or `tunnel.sh --apply`.

## Verification

```bash
scripts/operations/validate-config.sh operations.config.json
scripts/operations/cloudflare/deploy.sh --env development --plan
scripts/operations/cloudflare/deploy.sh --env production --plan
bunx wrangler deploy --dry-run
```

Run `tunnel.sh --check` only when the user explicitly asks for a read-only
account check and credentials are available. A drift report is not permission
to apply it.

## Contract

| Concern | Rule |
| --- | --- |
| Public config | Commit it in `wrangler.jsonc` and validate it in application code. |
| Runtime secrets | Source from Infisical when selected; never place them in Wrangler vars. |
| Bootstrap credentials | Never include `CLOUDFLARE_*` or `INFISICAL_*` in Worker secrets. |
| Tunnel mutations | Plan/check by default; `--apply` is human-operated. |
| Production deploy | Human or CI trigger only. |

## Common mistakes

- Do not duplicate deploy ordering in workflow YAML; workflows call the shared
  deploy script.
- Do not hard-code tunnel routes in shell. They come from service ports and
  `localHostname` values in the manifest.
- Do not treat a successful bundle dry run as a live deployment.
- Do not remove existing Cloudflare configuration that the module does not own.
