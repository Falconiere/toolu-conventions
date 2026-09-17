import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
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
      generatorVersion: "0.7.0",
      flags: {
        targetDirectory: target,
        name,
        stack,
        displayName: 'O\'Reilly "Labs" & <tools> {ready}',
        ...(stack === "marketing" ? { pages: ["home", "2026", "a/b", "a-b", "hero"] } : {}),
      },
    });

    try {
      const result = await generateProject({ manifest, assetRoot: resolve(".") });

      expect(result.targetDirectory).toBe(await realpath(target));
      expect(await Bun.file(join(target, "bun.lock")).exists()).toBe(true);
      expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
      if (stack === "marketing") {
        const home = await readFile(join(target, "dist/index.html"), "utf8");
        expect(home).not.toContain("&amp;quot;");
        expect(home).not.toContain("&amp;#39;");
        for (const route of ["2026", "a/b", "a-b", "hero"]) {
          const page = await readFile(join(target, "dist", route, "index.html"), "utf8");
          expect(page).toContain(`>${route.toUpperCase()}</p>`);
        }
      }
    } finally {
      await rm(temporary, { recursive: true });
    }
  }, 240_000);
}
