/// <reference types="vitest/config" />
/** Vitest config — Astro's own Vite config, plus the test block. */
import { getViteConfig } from 'astro/config';

// Unlike the console stack (where the Vitest block lives inside vite.config.ts),
// Astro owns its build config in astro.config.mjs and exposes it here through
// `getViteConfig`. That helper loads the Astro config, so aliases, integrations
// and env handling match the real build — there is no second source of truth.
export default getViteConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
    restoreMocks: true,
  },
});
