/** Vitest config — jsdom, for a library of components with no bundler of its own. */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// This package ships no build: consumers import the TS/TSX source straight
// through the workspace `exports` map, so there is no Vite config for a
// separate Vitest config to shadow — unlike the console app, one file here is
// the whole story.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.tsx", "src/**/__tests__/**/*.test.ts"],
    restoreMocks: true,
  },
});
