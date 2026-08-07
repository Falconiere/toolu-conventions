---
name: manage-infisical-secrets
description: Use when configuring or maintaining Infisical machine identities, secret paths, local .dev.vars delivery, CI secret bootstrap, or server-runtime secret synchronization in a project that uses operations.config.json.
---

# Manage Infisical Secrets

Keep Infisical as the server-runtime source of truth while preventing secrets
from entering committed files, client bundles, process evaluation, or logs.

## Workflow

1. Read `operations.config.json`, `.gitignore`, `.env.example`, and
   `scripts/operations/infisical/` before changing secret delivery.
2. Confirm the target is a server runtime. Supported stacks are backend-ts,
   Rust services, workspaces, and console projects whose runtime is `mixed`.
   Require `runtime: server` on every service with a secret target. Refuse
   Expo, static marketing, and client-only targets.
3. Keep bootstrap credentials named exactly
   `INFISICAL_URL`, `INFISICAL_PROJECT_ID`,
   `INFISICAL_MACHINE_IDENTITY_CLIENT_ID`, and
   `INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET` in CI secrets or ignored `.env`.
4. Put only paths and target filenames in the manifest. Never put secret values,
   client secrets, or machine credentials there.
5. Verify repository configuration locally. Do not authenticate, populate an
   environment, rotate credentials, or fetch live values unless the user asks
   for that separate external operation.

## Verification

```bash
scripts/operations/validate-config.sh operations.config.json
bash -n scripts/operations/shared/dotenv.sh
bash -n scripts/operations/shared/json-env.sh
bash -n scripts/operations/infisical/download.sh
git check-ignore .env .dev.vars
```

The downloader must stage output beside its target with mode `600`, then rename
it atomically. Existing valid local output may be used when refresh fails; no
file means startup must stop.

## Contract

| Data | Location |
| --- | --- |
| Machine identity | Ignored `.env` locally; CI secret store remotely |
| Secret path and output target | Committed `operations.config.json` |
| Local runtime values | Ignored `.dev.vars` or other server-only target |
| Deployed Worker values | Filtered JSON passed to Wrangler secret bulk |

## Common mistakes

- Do not use `eval` to parse dotenv values; secrets are data.
- Do not let credential files override explicitly exported CI values.
- Do not place secret targets under `src`, `public`, `assets`, `dist`, or
  `build`.
- Do not pass Cloudflare or Infisical bootstrap credentials into a Worker.
