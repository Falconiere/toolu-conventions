import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveConfiguration, withResolvedTheme } from "../src/configuration";
import { resolveImportedTheme } from "../src/theme";

describe("resolveConfiguration", () => {
  test("applies flags over config values and fills stable optional defaults", () => {
    const resolved = resolveConfiguration({
      generatorVersion: "0.6.0",
      config: {
        schemaVersion: 1,
        generatorVersion: "0.6.0",
        project: {
          name: "configured-name",
          displayName: "Configured Name",
          targetDirectory: "configured-target",
        },
        stack: { id: "marketing", pages: ["configured-page"] },
        integrations: ["blog"],
        operations: [],
        environments: ["development", "production"],
        theme: { kind: "preset", preset: "ion" },
        recipes: ["stack/marketing"],
      },
      flags: {
        targetDirectory: "flag-target",
        name: "flag-name",
        integrations: ["changelog"],
        pages: ["pricing"],
      },
    });

    expect(resolved.project).toEqual({
      name: "flag-name",
      displayName: "Configured Name",
      targetDirectory: "flag-target",
    });
    expect(resolved.stack).toEqual({ id: "marketing", pages: ["pricing"] });
    expect(resolved.integrations).toEqual(["changelog"]);
    expect(resolved.theme).toEqual({ kind: "preset", preset: "ion" });
    expect(resolved.recipes).toContain("theme/preset/ion");
    expect(resolved.staging).toBe(false);
  });

  test("replaces preset recipe identity when a theme import is resolved", async () => {
    const base = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "imported-console", name: "imported-console", stack: "console" },
    });
    const imported = await resolveImportedTheme(
      resolve("stacks/console/templates/theme"),
      "console",
    );

    const resolved = withResolvedTheme(base, imported);

    expect(resolved.theme).toEqual(imported);
    expect(resolved.recipes).toContain("theme/import/web");
    expect(resolved.recipes).not.toContain("theme/preset/jade");
  });
});
