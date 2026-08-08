import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration, withResolvedTheme } from "../../src/configuration";
import { planRecipe } from "../../src/recipes";
import { resolveImportedTheme, ThemeImportError } from "../../src/theme";

describe("theme import evals", () => {
  test("authors web imports byte-for-byte and records a web import recipe", async () => {
    const source = resolve("stacks/console/templates/theme");
    const base = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "web-import", name: "web-import", stack: "console" },
    });
    const manifest = withResolvedTheme(base, await resolveImportedTheme(source, "console"));

    const first = await planRecipe(manifest, resolve("."));
    const second = await planRecipe(manifest, resolve("."));

    expect(first).toEqual(second);
    expect(first.find((file) => file.path === "src/ui/theme/palette.css")?.content).toBe(
      await Bun.file(join(source, "palette.css")).text(),
    );
    expect(manifest.recipes).toContain("theme/import/web");
  });

  test("authors native imports byte-for-byte and rejects replay after tampering", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "toolu-native-import-"));
    const source = resolve("stacks/expo/templates/theme");
    const paths = ["colors.ts", "icons.ts", "motion.ts", "spacing.ts", "typography.ts"];
    try {
      for (const path of paths) {
        await writeFile(
          join(temporary, path),
          (await Bun.file(join(source, path)).text()).replace("{{TOOLU_THEME_PRESET}}", "ion"),
        );
      }
      const base = resolveConfiguration({
        generatorVersion: "0.6.0",
        flags: { targetDirectory: "native-import", name: "native-import", stack: "expo" },
      });
      const imported = await resolveImportedTheme(temporary, "expo");
      const manifest = withResolvedTheme(base, imported);
      const files = await planRecipe(manifest, resolve("."));

      expect(files.find((file) => file.path === "src/ui/theme/colors.ts")?.content).toBe(
        await Bun.file(join(temporary, "colors.ts")).text(),
      );
      expect(manifest.recipes).toContain("theme/import/native");

      await writeFile(join(temporary, "colors.ts"), "export const changed = true;\n");
      await expect(planRecipe(manifest, resolve("."))).rejects.toBeInstanceOf(ThemeImportError);
    } finally {
      await rm(temporary, { recursive: true });
    }
  });
});
