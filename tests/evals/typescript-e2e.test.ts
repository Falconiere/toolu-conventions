import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import { generateProject } from "../../src/engine";

for (const stack of ["console", "marketing", "backend-ts"] as const) {
  test(`real ${stack} eval installs dependencies and passes canonical check/build`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), `toolu-${stack}-e2e-`));
    const name = `verified-${stack}`;
    const target = join(temporary, name);
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: target, name, stack },
    });

    try {
      const result = await generateProject({ manifest, assetRoot: resolve(".") });

      expect(result.targetDirectory).toBe(target);
      expect(await Bun.file(join(target, "bun.lock")).exists()).toBe(true);
      expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
    } finally {
      await rm(temporary, { recursive: true });
    }
  }, 240_000);
}
