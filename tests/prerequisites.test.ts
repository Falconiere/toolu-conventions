import { describe, expect, test } from "bun:test";
import { resolveConfiguration } from "../src/configuration";
import { checkPrerequisites, PrerequisiteError } from "../src/prerequisites";

describe("prerequisite diagnostics", () => {
  test("reports the complete install-guidance list using user-facing tool names", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "missing-tools", name: "missing-tools", stack: "rust" },
    });

    const missing = await checkPrerequisites(manifest, {
      platform: "linux",
      nodeVersion: "20.11.1",
      path: "",
    });

    expect(missing).toEqual([
      "Node.js 20.12+",
      "bun",
      "bunx",
      "git",
      "jq",
      "ast-grep",
      "cargo",
      "rustfmt",
      "clippy",
    ]);
    expect(new PrerequisiteError(missing).message).toContain(
      "the initializer does not modify your global toolchain",
    );
  });

  test("explains that native Windows requires WSL", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "windows-project", name: "windows-project", stack: "console" },
    });

    expect(
      await checkPrerequisites(manifest, {
        platform: "win32",
        nodeVersion: "22.14.0",
        path: "",
      }),
    ).toEqual(["WSL (native Windows is not supported)"]);
  });
});
