import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import type { ResolutionFlags } from "../../src/contracts";
import { generateProject } from "../../src/engine";

const cases: Array<{ id: string; flags: ResolutionFlags }> = [
  {
    id: "console",
    flags: {
      stack: "console",
      integrations: ["api", "auth", "worker-api"],
      operations: ["cloudflare", "infisical", "local-dev"],
      domain: "console.example.test",
      theme: "blueprint",
    },
  },
  {
    id: "marketing",
    flags: {
      stack: "marketing",
      integrations: ["blog", "changelog", "ssr-cloudflare", "react-island", "analytics-posthog"],
      operations: ["cloudflare", "local-dev"],
      pages: ["home", "pricing", "about/team"],
      domain: "www.example.test",
      theme: "ion",
    },
  },
  {
    id: "backend-workspace",
    flags: {
      stack: "backend-ts",
      integrations: ["auth", "structured-logging", "drizzle", "database-package"],
      operations: ["cloudflare", "infisical", "local-dev"],
      domain: "api.example.test",
    },
  },
];

for (const scenario of cases) {
  test(`maximal ${scenario.id} eval passes install, hooks, canonical checks, build, and operations validation`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), `toolu-max-${scenario.id}-`));
    const name = `max-${scenario.id}`;
    const target = join(temporary, name);
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { ...scenario.flags, targetDirectory: target, name },
    });

    try {
      await generateProject({ manifest, assetRoot: resolve(".") });
      expect(await Bun.file(join(target, "toolu.scaffold.json")).exists()).toBe(true);
      expect(await Bun.file(join(target, "operations.config.json")).exists()).toBe(true);
    } finally {
      await rm(temporary, { recursive: true });
    }
  }, 360_000);
}
