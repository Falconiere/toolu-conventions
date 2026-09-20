import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import type { ResolutionFlags } from "../../src/contracts";
import { generateProject } from "../../src/engine";

const flags: ResolutionFlags = {
  layout: "monorepo",
  apps: [
    { id: "console", stack: "console", integrations: ["api"] },
    { id: "api", stack: "backend-ts", integrations: ["drizzle", "database-package"] },
    { id: "marketing", stack: "marketing", integrations: [], pages: ["home", "pricing"] },
  ],
  packages: ["database", "ui", "types", "config"],
  operations: ["local-dev"],
  theme: "jade",
};

test("monorepo eval installs one workspace and passes the root gate", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "toolu-monorepo-e2e-"));
  // A dotted name has to survive as the project identity while every derived
  // npm, Worker and Cargo identifier stays dot-free.
  const name = "agavus.io";
  const target = join(temporary, "agavus.io");
  const manifest = resolveConfiguration({
    generatorVersion: "0.8.1",
    flags: { ...flags, targetDirectory: target, name },
  });

  try {
    await generateProject({ manifest, assetRoot: resolve(".") });

    const rootPackage: unknown = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    expect(rootPackage).toMatchObject({
      name: "agavus-io",
      // The config package ships lint bases only, so members are listed one
      // by one rather than globbed.
      workspaces: ["apps/*", "packages/database", "packages/ui", "packages/types"],
    });
    const apiPackage: unknown = JSON.parse(
      await readFile(join(target, "apps/api/package.json"), "utf8"),
    );
    expect(apiPackage).toMatchObject({
      name: "@agavus-io/api",
      dependencies: { "@agavus-io/database": "workspace:*" },
    });
    expect(await Bun.file(join(target, "bun.lock")).exists()).toBe(true);
    expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
    expect(await Bun.file(join(target, "operations.config.json")).exists()).toBe(true);
    expect(await Bun.file(join(target, "apps/console/package.json")).exists()).toBe(true);
    expect(await Bun.file(join(target, "packages/database/package.json")).exists()).toBe(true);
    // Both web apps built inside the workspace, not just type-checked.
    expect(await Bun.file(join(target, "apps/console/dist/index.html")).exists()).toBe(true);
    expect(await Bun.file(join(target, "apps/marketing/dist/index.html")).exists()).toBe(true);
    expect(await Bun.file(join(target, "packages/ui/src/components/surface.tsx")).exists()).toBe(
      true,
    );
    expect(await Bun.file(join(target, "packages/config/base.oxlintrc.json")).exists()).toBe(true);
  } finally {
    await rm(temporary, { recursive: true });
  }
}, 600_000);
