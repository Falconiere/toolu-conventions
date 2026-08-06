/** Vitest config — runs every test inside the real Workers runtime (workerd). */
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Tests execute in workerd, not Node, and read the SAME wrangler config the
// deploy uses. That is the point: a service whose tests run in a different
// runtime from production can pass a green suite and still fail on the first
// request (missing binding, unsupported API, wrong compatibility flag).
//
// Local secrets come from `.dev.vars`, so a test hits the real Turso database
// you point it at — real data, no mocks (CORE rule 7).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
    restoreMocks: true,
  },
});
