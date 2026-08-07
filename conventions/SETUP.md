# SETUP — Operations Modules

Run this after the selected stack has been scaffolded. Operations modules are
opt-in and composable; copy only what the intake selected.

## Shared contract

When at least one module is selected:

1. Copy `conventions/shared/templates/operations.config.json` to the project
   root and tailor its services. Classify every service runtime as `client`,
   `static`, or `server`. Environments remain exactly `local`, `development`,
   and `production`.
2. Copy the contents of
   `conventions/shared/templates/scripts/operations/` into
   `scripts/operations/`.
3. Add `.tooling/`, `.env`, and every configured `secretsTarget` to `.gitignore`.
4. Run `scripts/operations/validate-config.sh operations.config.json` before
   copying a provider or dev module.

Then execute each selected module's `SETUP.md`. `local-dev` is independent;
its Infisical refresh and Cloudflare tunnel adapters activate only when those
provider sections and scripts are also present.

## Finish

Run `bash -n` over every copied shell script and the module verification
commands. Print the combined human-only checklist; do not authenticate to a
provider or apply account changes during scaffolding.
