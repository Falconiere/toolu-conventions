import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveImportedTheme, verifyImportedTheme } from "../src/theme";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("resolveImportedTheme", () => {
  test("records exact web token files and their SHA-256 hashes", async () => {
    const source = await mkdtemp(join(tmpdir(), "toolu-theme-"));
    temporaryDirectories.push(source);
    await writeFile(join(source, "palette.css"), "palette\n");
    await writeFile(join(source, "scale.css"), "scale\n");
    const theme = await resolveImportedTheme(source, "console");

    expect(theme).toEqual({
      kind: "import",
      source,
      files: [
        {
          path: "palette.css",
          target: "web",
          sha256: "ad362be007434735f790538e0423b817fc935b5033f83a72e712cb0f31c44ae3",
        },
        {
          path: "scale.css",
          target: "web",
          sha256: "45512e60fb8efd1dc057c6717cf36f2d07786af71acd044babc68a10148e35b0",
        },
      ],
    });
  });

  test("rejects an imported-theme file replaced by an escaping symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "toolu-theme-boundary-"));
    temporaryDirectories.push(root);
    const source = join(root, "theme");
    await mkdir(source);
    await writeFile(join(source, "palette.css"), "palette\n");
    await writeFile(join(source, "scale.css"), "scale\n");
    await writeFile(join(root, "secret.css"), "secret\n");
    const theme = await resolveImportedTheme(source, "console");
    await rm(join(source, "palette.css"));
    await symlink(join(root, "secret.css"), join(source, "palette.css"));

    await expect(verifyImportedTheme(theme)).rejects.toThrow(
      "theme file path escapes its source: palette.css",
    );
  });
});
