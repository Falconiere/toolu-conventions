# SETUP — Infisical Secrets

Use for server runtimes: `backend-ts`, Rust services, compatible workspaces, or
a console with a same-project Worker API (`runtime: mixed`). Never install this
module into client-only, Expo, or static marketing output.

## Install

1. Complete [`../SETUP.md`](../SETUP.md)'s shared-contract steps.
2. Copy `templates/scripts/operations/infisical/` to
   `scripts/operations/infisical/` and make each `.sh` executable.
   `install-cli.sh` owns the Infisical CLI version and checksums; do not
   duplicate them in CI or another module.
3. Copy `templates/.env.operations.example` to `.env.example` by merging the
   four `INFISICAL_*` keys with any existing example. Never overwrite unrelated
   example entries.
4. Use `templates/operations.infisical.example.json` as the exact shape to
   merge into `operations.config.json`: merge its `infisical` object at the
   root and its `serviceFields` into each server service, then discard the
   example-only `serviceFields` wrapper. Add every target to `.gitignore`.
5. Copy `skills/manage-infisical-secrets/` from the kit to
   `.agents/skills/manage-infisical-secrets/` unchanged.

For a `package.json` project, add a `secrets:local` convenience command that
calls the downloader with the manifest's local target. The local-dev adapter
does this automatically when selected.

## Verify

```bash
scripts/operations/validate-config.sh operations.config.json
bash -n scripts/operations/shared/dotenv.sh
bash -n scripts/operations/shared/json-env.sh
bash -n scripts/operations/infisical/download.sh
git check-ignore .env
```

## Human-only checklist

- Create the Infisical project and the `local`, `development`, and `production`
  environments.
- Create a least-privilege universal-auth machine identity.
- Put its four bootstrap values in ignored `.env` and CI secrets.
- Populate and review each environment's server-runtime values.
