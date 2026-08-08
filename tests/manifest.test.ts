import { describe, expect, test } from "bun:test";
import { assertGeneratorCompatibility, ManifestCompatibilityError } from "../src/manifest";

describe("manifest generator compatibility", () => {
  test("rejects manifests from another pre-1.0 minor line", () => {
    expect(() => assertGeneratorCompatibility("0.5.9", "0.6.0")).toThrow(
      ManifestCompatibilityError,
    );
    expect(() => assertGeneratorCompatibility("0.5.9", "0.6.0")).toThrow(
      "manifest generator 0.5.9 is not compatible with 0.6.0",
    );
  });
});
