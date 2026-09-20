/** Vitest config — plain Node, no DOM. Contracts are pure functions of input. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// No pool, no workers, no jsdom: a zod schema takes a value and returns a
// value, so the fastest correct runtime for its tests is plain Node — nothing
// here talks to a browser API or a Workers binding.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // No passWithNoTests. This package SHIPS a test file, so a run that matches
  // nothing means the glob broke, not that nobody has written tests yet.
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
