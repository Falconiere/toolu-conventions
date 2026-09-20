import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseArgs } from "../src/args";
import { CompatibilityError } from "../src/compatibility";
import { resolveConfiguration } from "../src/configuration";
import type { ResolutionFlags } from "../src/contracts";
import { planCommands } from "../src/engine";
import { parseManifest } from "../src/manifest";
import { planRecipe, type PlannedFile } from "../src/recipes";
import { renderSummary } from "../src/summary";

const workspaceFlags: ResolutionFlags = {
  targetDirectory: "agavus.io",
  name: "agavus.io",
  layout: "monorepo",
  apps: [
    { id: "console", stack: "console", integrations: ["api"] },
    { id: "api", stack: "backend-ts", integrations: ["drizzle", "database-package"] },
    { id: "marketing", stack: "marketing", integrations: [], pages: ["home", "pricing"] },
  ],
  packages: ["database"],
};

function resolveWorkspace(overrides: Partial<ResolutionFlags> = {}) {
  return resolveConfiguration({
    generatorVersion: "0.8.1",
    flags: { ...workspaceFlags, ...overrides },
  });
}

function plannedContent(files: readonly PlannedFile[], path: string): string {
  const file = files.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`planned file is missing: ${path}`);
  return file.content;
}

describe("monorepo configuration", () => {
  test("keeps the dotted project name and gives every app its own port", () => {
    const manifest = resolveWorkspace();
    if (manifest.layout !== "monorepo") throw new Error("expected a monorepo manifest");
    expect(manifest.project).toEqual({
      name: "agavus.io",
      displayName: "Agavus",
      targetDirectory: "agavus.io",
    });
    expect(manifest.apps.map((app) => [app.id, app.stack.id, app.port])).toEqual([
      ["console", "console", 5173],
      ["api", "backend-ts", 8787],
      ["marketing", "marketing", 4321],
    ]);
    expect(manifest.packages).toEqual(["database"]);
    expect(manifest.recipes).toContain("app/api/integration/database-package");
  });

  test("wires the database package and the API app in both directions", () => {
    const fromPackage = resolveWorkspace({
      apps: [{ id: "api", stack: "backend-ts", integrations: [] }],
      packages: ["database"],
    });
    if (fromPackage.layout !== "monorepo") throw new Error("expected a monorepo manifest");
    expect(fromPackage.apps[0]?.integrations).toEqual(["drizzle", "database-package"]);

    const fromApp = resolveWorkspace({
      apps: [{ id: "api", stack: "backend-ts", integrations: ["drizzle", "database-package"] }],
      packages: [],
    });
    if (fromApp.layout !== "monorepo") throw new Error("expected a monorepo manifest");
    expect(fromApp.packages).toEqual(["database"]);
  });

  test("resolves port collisions and rejects duplicate app directories", () => {
    const manifest = resolveWorkspace({
      apps: [
        { id: "one", stack: "console", integrations: [] },
        { id: "two", stack: "console", integrations: [] },
      ],
      packages: [],
    });
    if (manifest.layout !== "monorepo") throw new Error("expected a monorepo manifest");
    expect(manifest.apps.map((app) => app.port)).toEqual([5173, 5174]);

    expect(() =>
      resolveWorkspace({
        apps: [
          { id: "web", stack: "console", integrations: [] },
          { id: "web", stack: "marketing", integrations: [] },
        ],
        packages: [],
      }),
    ).toThrow("Duplicate app directory: web");
  });

  test("rejects a port two apps both asked for, and routes on a stack without them", () => {
    expect(() =>
      resolveWorkspace({
        apps: [
          { id: "console", stack: "console", integrations: [], port: 4000 },
          { id: "api", stack: "backend-ts", integrations: [], port: 4000 },
        ],
        packages: [],
      }),
    ).toThrow("Duplicate app port: 4000 is requested by console and api");
    expect(() =>
      resolveWorkspace({
        apps: [{ id: "console", stack: "console", integrations: [], pages: ["pricing"] }],
        packages: [],
      }),
    ).toThrow("Routes are a marketing stack feature: console is console");
  });

  test("keeps a requested port and moves the defaulted app instead", () => {
    const manifest = resolveWorkspace({
      apps: [
        { id: "one", stack: "console", integrations: [] },
        { id: "two", stack: "console", integrations: [], port: 5173 },
      ],
      packages: [],
    });
    if (manifest.layout !== "monorepo") throw new Error("expected a monorepo manifest");
    expect(manifest.apps.map((app) => [app.id, app.port])).toEqual([
      ["one", 5174],
      ["two", 5173],
    ]);
  });

  test("allows an operations module any single app can host", () => {
    const manifest = resolveWorkspace({ operations: ["infisical"] });
    expect(manifest.operations).toEqual(["infisical"]);
    // Marketing alone has no server runtime for Infisical, so nothing hosts it.
    expect(() =>
      resolveWorkspace({
        apps: [{ id: "site", stack: "marketing", integrations: [] }],
        packages: [],
        operations: ["infisical"],
      }),
    ).toThrow(CompatibilityError);
  });

  test("refuses an imported theme shared by web and native apps", () => {
    expect(() =>
      parseManifest({
        schemaVersion: 1,
        generatorVersion: "0.8.1",
        layout: "monorepo",
        project: { name: "agavus.io", displayName: "Agavus", targetDirectory: "agavus.io" },
        apps: [
          { id: "web", stack: { id: "console" }, integrations: [], port: 5173 },
          { id: "mobile", stack: { id: "expo" }, integrations: [], port: 8081 },
        ],
        packages: [],
        operations: [],
        environments: ["development", "production"],
        staging: false,
        theme: {
          kind: "import",
          source: "/tmp/theme",
          files: [{ path: "palette.css", target: "web", sha256: "a".repeat(64) }],
        },
        runtime: {},
        recipes: ["layout/monorepo"],
      }),
    ).not.toThrow();
    const manifest = resolveWorkspace({
      apps: [
        { id: "web", stack: "console", integrations: [] },
        { id: "mobile", stack: "expo", integrations: [] },
      ],
      packages: [],
    });
    expect(manifest.theme).toEqual({ kind: "preset", preset: "jade" });
  });

  test("defaults a manifest written before layout existed to standalone", () => {
    const manifest = parseManifest({
      schemaVersion: 1,
      generatorVersion: "0.8.1",
      project: { name: "legacy", displayName: "Legacy", targetDirectory: "legacy" },
      stack: { id: "console" },
      integrations: [],
      operations: [],
      environments: ["development", "production"],
      staging: false,
      theme: { kind: "preset", preset: "jade" },
      runtime: { port: 5173 },
      recipes: ["stack/console"],
    });
    expect(manifest.layout).toBe("standalone");
  });
});

describe("monorepo command line", () => {
  test("parses scoped app options", () => {
    const parsed = parseArgs([
      "agavus.io",
      "--layout=monorepo",
      "--name=agavus.io",
      "--app=web=console",
      "--app-integration=web=api",
      "--app",
      "site=marketing",
      "--app-page=site=pricing",
      "--app-port=site=4300",
      "--package=database",
    ]);
    expect(parsed).toEqual({
      targetDirectory: "agavus.io",
      layout: "monorepo",
      name: "agavus.io",
      apps: [
        { id: "web", stack: "console", integrations: ["api"] },
        { id: "site", stack: "marketing", pages: ["pricing"], port: 4300 },
      ],
      packages: ["database"],
    });
  });

  test("rejects a scoped option for an app no --app declared", () => {
    expect(() => parseArgs(["target", "--app-integration=api=auth"])).toThrow(
      "--app-integration names an app that no --app declared: api",
    );
    expect(() => parseArgs(["target", "--app=web"])).toThrow("--app expects <app>=<value>");
  });

  test("requires at least one app for a monorepo", () => {
    expect(() =>
      resolveConfiguration({
        generatorVersion: "0.8.1",
        flags: { targetDirectory: "empty", name: "empty", layout: "monorepo" },
      }),
    ).toThrow("--app");
  });
});

describe("monorepo plan", () => {
  test("plans one command per app and installs the workspace once", () => {
    const manifest = resolveWorkspace({
      apps: [
        { id: "api", stack: "backend-ts", integrations: ["drizzle", "database-package"] },
        { id: "cli", stack: "rust", integrations: ["clap"] },
      ],
      packages: ["database"],
    });
    expect(planCommands(manifest).map(({ command, args }) => [command, ...args])).toEqual([
      ["bun", "install", "--network-concurrency=8"],
      ["cargo", "fetch", "--manifest-path", "apps/cli/Cargo.toml"],
      ["bun", "run", "--filter", "@agavus-io/api", "cf-typegen"],
      ["bun", "run", "fmt"],
      ["git", "init", "--initial-branch=main"],
      ["bunx", "lefthook@2.1.10", "install", "--force"],
      ["bun", "run", "check"],
      ["cargo", "fmt", "--manifest-path", "apps/cli/Cargo.toml", "--check"],
      [
        "cargo",
        "clippy",
        "--manifest-path",
        "apps/cli/Cargo.toml",
        "--all-targets",
        "--all-features",
        "--",
        "-D",
        "warnings",
      ],
      ["cargo", "test", "--manifest-path", "apps/cli/Cargo.toml", "--all-features"],
    ]);
  });

  test("moves each app under apps/ and leaves the shared files at the root", async () => {
    const manifest = resolveWorkspace({ operations: ["local-dev"] });
    const files = await planRecipe(manifest, resolve("."));
    const paths = new Set(files.map((file) => file.path));

    for (const path of [
      "apps/console/src/main.tsx",
      "apps/api/src/app.ts",
      "apps/marketing/src/pages/index.astro",
      "packages/database/src/schema/tables.ts",
      "package.json",
      "knip.json",
      "lefthook.yml",
      "guardrails.workspace.json",
      "operations.config.json",
      ".github/workflows/ci.yml",
      ".oxfmtignore",
    ]) {
      expect(paths.has(path)).toBe(true);
    }
    // A member never carries the files the workspace root owns, and an app is
    // never itself a nested workspace.
    for (const path of [
      "apps/console/lefthook.yml",
      "apps/console/.oxfmtignore",
      "apps/api/packages/api/package.json",
      "apps/api/knip.json.workspaces",
    ]) {
      expect(paths.has(path)).toBe(false);
    }

    const apiPackage: unknown = JSON.parse(plannedContent(files, "apps/api/package.json"));
    expect(apiPackage).toMatchObject({
      name: "@agavus-io/api",
      dependencies: { "@agavus-io/database": "workspace:*" },
      scripts: {
        "check:structure": "bash ../../scripts/guardrails/run.sh",
        "fmt:check": "oxfmt --check --ignore-path ../../.oxfmtignore",
      },
    });
    expect(JSON.parse(plannedContent(files, "apps/api/package.json"))).not.toHaveProperty(
      "scripts.prepare",
    );
    expect(JSON.parse(plannedContent(files, "apps/console/base.oxlintrc.json"))).toMatchObject({
      jsPlugins: ["./../../scripts/guardrails/oxlint-plugin/index.js"],
    });
    expect(JSON.parse(plannedContent(files, "apps/console/guardrails.config.json"))).toMatchObject({
      $schema: "./../../scripts/guardrails/schema.json",
    });
    expect(JSON.parse(plannedContent(files, "apps/api/wrangler.jsonc"))).toMatchObject({
      name: "agavus-io-api",
    });
    expect(JSON.parse(plannedContent(files, "guardrails.workspace.json"))).toMatchObject({
      packages: ["apps/console", "apps/api", "apps/marketing", "packages/database"],
    });
    const operations: unknown = JSON.parse(plannedContent(files, "operations.config.json"));
    expect(operations).toMatchObject({
      stack: "workspace",
      services: [
        { name: "console", runtime: "client", command: "bun run --filter @agavus-io/console dev" },
        { name: "api", runtime: "server", port: 8787 },
        { name: "marketing", runtime: "static", port: 4321 },
      ],
    });
  });

  test("wires an operations module only into the apps that can host it", async () => {
    const manifest = resolveWorkspace({ operations: ["infisical"] });
    const files = await planRecipe(manifest, resolve("."));
    const operations: unknown = JSON.parse(plannedContent(files, "operations.config.json"));
    expect(operations).toMatchObject({
      services: [
        // A client app has no server runtime to read .dev.vars, and marketing
        // is statically rendered — neither gets a secrets target.
        { name: "console", runtime: "client" },
        { name: "api", runtime: "server", secretsTarget: "apps/api/.dev.vars" },
        { name: "marketing", runtime: "static" },
      ],
    });
    const services = (operations as { services: Record<string, unknown>[] }).services;
    expect(services[0]).not.toHaveProperty("secretsTarget");
    expect(services[2]).not.toHaveProperty("secretsTarget");
  });

  test("lists Bun members explicitly when a Rust app joins the workspace", async () => {
    const manifest = resolveWorkspace({
      apps: [
        { id: "api", stack: "backend-ts", integrations: [] },
        { id: "cli", stack: "rust", integrations: ["clap"] },
      ],
      packages: [],
    });
    const files = await planRecipe(manifest, resolve("."));
    expect(JSON.parse(plannedContent(files, "package.json"))).toMatchObject({
      workspaces: ["apps/api"],
    });
    const cargo = plannedContent(files, "apps/cli/Cargo.toml");
    // The rename lands in [package], not on a key that happens to be called
    // `name` somewhere else in the manifest.
    expect(/\[package\]\n(?:[^[]*\n)?name = "agavus-io-cli"/.test(cargo)).toBe(true);
    expect(cargo).not.toContain('name = "agavus-io"');
    expect(plannedContent(files, ".gitignore")).toContain("target/");
  });

  test("names the single Cloudflare deploy target and the apps it leaves out", async () => {
    const manifest = resolveWorkspace({ operations: ["cloudflare"] });
    const files = await planRecipe(manifest, resolve("."));
    const readme = plannedContent(files, "README.md");
    // The operations schema carries one worker pair, so the choice is forced —
    // the README is where the apps it did not pick get their instruction.
    expect(readme).toContain("carries one Cloudflare worker pair, and it is\n`apps/api`");
    expect(readme).toContain("bun run --filter @agavus-io/console deploy");
    expect(readme).toContain("bun run --filter @agavus-io/marketing deploy");

    const quiet = await planRecipe(resolveWorkspace({ operations: ["local-dev"] }), resolve("."));
    expect(plannedContent(quiet, "README.md")).not.toContain("## Deploys");
  });

  test("summarises the workspace for the interactive review", () => {
    expect(renderSummary(resolveWorkspace())).toContain("Layout: monorepo");
    expect(renderSummary(resolveWorkspace())).toContain("App apps/api: backend-ts · port 8787");
  });
});
