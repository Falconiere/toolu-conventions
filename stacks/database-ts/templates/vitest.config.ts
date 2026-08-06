/** Vitest config — the schema and client are exercised inside workerd. */
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// The package has no Worker entry, and the pool does not need one: it boots
// workerd from this wrangler.jsonc alone. Running here rather than in Node is
// what makes a passing test mean something — `drizzle-orm/libsql/web` and
// `@libsql/client/web` behave differently under Node's resolver, and a suite
// that proves the Node path works proves nothing about production.
//
// Local credentials come from `.dev.vars`, so a test hits the real Turso
// database you point it at. A mock client is banned (CORE rule 7).
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
});
