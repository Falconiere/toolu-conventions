import { describe, expect, test } from "bun:test";
import {
  assertGeneratorCompatibility,
  ManifestCompatibilityError,
  parseManifest,
} from "../src/manifest";

const validManifest = {
  schemaVersion: 1,
  generatorVersion: "0.6.0",
  project: { name: "acme", displayName: "Acme", targetDirectory: "acme" },
  stack: { id: "console" },
  integrations: [],
  operations: [],
  environments: ["development", "production"],
  staging: false,
  theme: { kind: "preset", preset: "jade" },
  runtime: { port: 5173 },
  recipes: ["stack/console", "theme/preset/jade"],
};

describe("manifest generator compatibility", () => {
  test("rejects manifests from another pre-1.0 minor line", () => {
    expect(() => assertGeneratorCompatibility("0.5.9", "0.6.0")).toThrow(
      ManifestCompatibilityError,
    );
    expect(() => assertGeneratorCompatibility("0.5.9", "0.6.0")).toThrow(
      "manifest generator 0.5.9 is not compatible with 0.6.0",
    );
  });

  test("uses stable-major compatibility after 1.0", () => {
    expect(() => assertGeneratorCompatibility("1.2.3", "1.9.0")).not.toThrow();
    expect(() => assertGeneratorCompatibility("1.9.0", "2.0.0")).toThrow(
      ManifestCompatibilityError,
    );
  });
});

describe("manifest collections", () => {
  test("rejects duplicate integrations, operations, environments, and recipes", () => {
    for (const duplicate of [
      { integrations: ["api", "api"] },
      { operations: ["local-dev", "local-dev"] },
      { environments: ["development", "development"] },
      { recipes: ["stack/console", "stack/console"] },
    ]) {
      expect(() => parseManifest({ ...validManifest, ...duplicate })).toThrow();
    }
  });

  test("rejects duplicate marketing pages", () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        stack: { id: "marketing", pages: ["home", "home"] },
      }),
    ).toThrow();
  });

  test("rejects provider operations combined with manual staging", () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        operations: ["cloudflare"],
        staging: true,
      }),
    ).toThrow();
  });

  test("rejects imported-theme paths outside the supported token surface", () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        theme: {
          kind: "import",
          source: "/tmp/theme",
          files: [{ path: "../palette.css", target: "web", sha256: "0".repeat(64) }],
        },
      }),
    ).toThrow();
  });
});
