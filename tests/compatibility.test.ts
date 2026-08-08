import { describe, expect, test } from "bun:test";
import { CompatibilityError, validateCompatibility } from "../src/compatibility";
import { resolveConfiguration } from "../src/configuration";
import { parseManifest } from "../src/manifest";

describe("compatibility rules", () => {
  test("requires Drizzle for a database workspace and Axum for Rust local dev", () => {
    expect(() =>
      resolveConfiguration({
        generatorVersion: "0.6.0",
        flags: {
          targetDirectory: "bad-workspace",
          name: "bad-workspace",
          stack: "backend-ts",
          integrations: ["database-package"],
        },
      }),
    ).toThrow("database-package requires drizzle");
    expect(() =>
      resolveConfiguration({
        generatorVersion: "0.6.0",
        flags: {
          targetDirectory: "bad-rust",
          name: "bad-rust",
          stack: "rust",
          operations: ["local-dev"],
        },
      }),
    ).toThrow("require axum");
  });

  test("rejects duplicate marketing pages", () => {
    expect(() =>
      resolveConfiguration({
        generatorVersion: "0.6.0",
        flags: {
          targetDirectory: "duplicate-pages",
          name: "duplicate-pages",
          stack: "marketing",
          pages: ["home", "pricing", "pricing"],
        },
      }),
    ).toThrow("pages must be unique");
  });

  test("accepts only the exact imported token surface for a visual stack", () => {
    const base = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "bad-theme", name: "bad-theme", stack: "console" },
    });
    const manifest = parseManifest({
      ...base,
      theme: {
        kind: "import",
        source: "/tmp/theme",
        files: [
          { path: "palette.css", target: "web", sha256: "a".repeat(64) },
          { path: "scale.css", target: "native", sha256: "b".repeat(64) },
        ],
      },
    });

    expect(() => validateCompatibility(manifest)).toThrow(CompatibilityError);
    expect(() => validateCompatibility(manifest)).toThrow(
      "console theme import must contain exactly: palette.css, scale.css",
    );
  });
});
