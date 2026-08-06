# Spike — does `@cloudflare/vitest-pool-workers` boot for a Worker-less library package?

**Date:** 2026-08-06   **Spec:** [2026-08-06-database-ts-monorepo-design.md](../specs/2026-08-06-database-ts-monorepo-design.md) Open Question 1
**Verdict:** workerd

## Question

`packages/database` is a library: it has no Worker entry and no `main` in its
`wrangler.jsonc`. CORE rule 14 wants its tests to run in the real runtime
against real data. Does the pool boot without a Worker, or does the package
have to fall back to plain Vitest in Node?

## What was run

A throwaway package with no Worker entry — `wrangler.jsonc` carrying only
`name`, `compatibility_date` and `nodejs_compat`; `package.json` exposing a
`exports` map and no `main`; `vitest@4.1.0` with
`@cloudflare/vitest-pool-workers@0.20.2`.

Two assertions, both against the real runtime:

```ts
test('the pool booted workerd for a package with no Worker entry', () => {
  expect(navigator.userAgent).toBe('Cloudflare-Workers');
});
test('drizzle + libsql/web construct inside workerd', () => {
  const database = createDatabase({ url: 'libsql://example.turso.io', authToken: 't' });
  expect(typeof database.select).toBe('function');
});
```

```
Test Files  1 passed (1)
     Tests  2 passed (2)
  Duration  6.21s
```

## Findings

1. **The pool boots without a Worker entry.** `navigator.userAgent` is
   `Cloudflare-Workers`, so the test really executed in workerd, not Node. No
   `main` and no default export were needed. `packages/database` gets a real
   `vitest.config.ts` and AC-14's "inside workerd" half holds.
2. **`drizzle-orm/libsql/web` + `@libsql/client/web` load and construct inside
   workerd.** The bundler resolves the `/web` entries and the handle is usable.
3. **Use the current pool API.** `defineWorkersConfig` from
   `@cloudflare/vitest-pool-workers/config` no longer exists — 0.20.2 exports
   only `.`, `./types` and a codemod, and importing the old specifier fails at
   config load with `Missing "./config" specifier`. The correct form is the one
   `stacks/backend-ts/templates/vitest.config.ts` already uses: the
   `cloudflareTest` plugin composed into `defineConfig` from `vitest/config`.
   The `database-ts` template must copy that shape, not the older guides'.

## What this spike did NOT prove

**The network round-trip.** Constructing the client is not the same as reaching
a database, and this environment has no Turso credentials. AC-14's "against a
real Turso database" half is therefore still unverified: it needs one manual
run with real credentials, and it belongs on the generated project's human
checklist, not the kit's CI. Do not describe the gate as covering it.
