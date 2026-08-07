---
name: manage-local-dev
description: Use when configuring or maintaining manifest-driven local services, commands, ports, health probes, process cleanup, Infisical refresh adapters, or Cloudflare development tunnels in a project that uses operations.config.json.
---

# Manage Local Dev

Make one command start the declared services safely. The manifest owns topology;
the supervisor owns only processes it can identify as its own.

## Workflow

1. Read `operations.config.json` and `scripts/operations/dev/` before editing
   service commands, ports, probes, or adapters.
2. Add each service with a unique kebab-case name, `client`/`static`/`server`
   runtime, command, port, and optional HTTP health probe. Add `secretsTarget`
   or `localHostname` only when its provider module is selected.
3. Validate before starting anything. Fix duplicate ports/hostnames and missing
   tools; never work around them by choosing an undeclared port.
4. Preserve process ownership records as PID plus process-start fingerprint.
   Stop only a live process matching both values.
5. Keep provider failures scoped: missing Cloudflare credentials skip the
   tunnel with a warning; failed Infisical refresh may use an existing target,
   but must stop when none exists.
6. Run the checks below without starting long-lived services. Leave live tunnel
   or secret-store work to an explicit user request.

## Verification

```bash
scripts/operations/validate-config.sh operations.config.json
scripts/operations/dev/preflight.sh --check-config
bash -n scripts/operations/dev/ports.sh
bash -n scripts/operations/dev/start.sh
```

## Process-safety contract

| Situation | Behavior |
| --- | --- |
| Previous recorded process still matches | Stop it gracefully. |
| PID exists with another start fingerprint | Treat it as foreign; never signal it. |
| Unrecorded process owns a configured port | Fail and report PID, command, and port. |
| Child exits after startup | Stop only the other recorded children. |
| Health probe times out | Stop the owned stack and name the failed service. |

## Common mistakes

- Do not hard-code a console/marketing topology in shell.
- Do not automatically kill every listener on a configured port.
- Do not make local dev depend on Cloudflare or Infisical; their adapters are
  optional.
- Do not silently let frameworks choose another port because tunnel routing
  and callbacks would still use the declared one.
