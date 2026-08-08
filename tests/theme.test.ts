import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveImportedTheme } from "../src/theme";

describe("resolveImportedTheme", () => {
  test("records exact web token files and their SHA-256 hashes", async () => {
    const source = resolve("stacks/console/templates/theme");
    const theme = await resolveImportedTheme(source, "console");

    expect(theme).toEqual({
      kind: "import",
      source,
      files: [
        {
          path: "palette.css",
          target: "web",
          sha256: "dd9c6447a114208365c86289128ae710133722b03a3f0d35e1fab45be7656057",
        },
        {
          path: "scale.css",
          target: "web",
          sha256: "6b06a6e81bdd88de75b1a2bc98e9bcce6eb69c93a0d5f5cf80682f7a68e6708c",
        },
      ],
    });
  });
});
