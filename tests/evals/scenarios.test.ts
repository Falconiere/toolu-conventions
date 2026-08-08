import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import type { ResolutionFlags } from "../../src/contracts";
import { planRecipe, type PlannedFile } from "../../src/recipes";

interface Scenario {
  id: string;
  flags: ResolutionFlags;
  requiredFiles: string[];
}

const baseFlags = (name: string, stack: string): ResolutionFlags => ({
  targetDirectory: name,
  name,
  stack,
});

const scenarios: Scenario[] = [
  {
    id: "console-base",
    flags: baseFlags("eval-console", "console"),
    requiredFiles: ["src/main.tsx"],
  },
  {
    id: "marketing-base",
    flags: baseFlags("eval-marketing", "marketing"),
    requiredFiles: ["src/pages/index.astro"],
  },
  {
    id: "backend-base",
    flags: baseFlags("eval-backend", "backend-ts"),
    requiredFiles: ["src/app.ts"],
  },
  { id: "expo-base", flags: baseFlags("eval-expo", "expo"), requiredFiles: ["app/_layout.tsx"] },
  { id: "rust-base", flags: baseFlags("eval-rust", "rust"), requiredFiles: ["src/main.rs"] },
  {
    id: "console-max",
    flags: {
      ...baseFlags("eval-console-max", "console"),
      integrations: ["api", "auth", "worker-api"],
      operations: ["cloudflare", "infisical", "local-dev"],
      domain: "console.example.test",
      theme: "blueprint",
    },
    requiredFiles: [
      "src/api/orpc.ts",
      "src/api/auth-client.ts",
      "src/worker.ts",
      "operations.config.json",
    ],
  },
  {
    id: "marketing-max",
    flags: {
      ...baseFlags("eval-marketing-max", "marketing"),
      integrations: ["blog", "changelog", "ssr-cloudflare", "react-island", "analytics-posthog"],
      operations: ["cloudflare", "local-dev"],
      pages: ["home", "pricing", "about/team"],
      domain: "www.example.test",
      theme: "ion",
    },
    requiredFiles: [
      "src/pages/blog/index.astro",
      "src/pages/changelog/index.astro",
      "src/ui/signup-island.tsx",
      "operations.config.json",
    ],
  },
  {
    id: "backend-workspace-max",
    flags: {
      ...baseFlags("eval-platform", "backend-ts"),
      integrations: ["auth", "structured-logging", "drizzle", "database-package"],
      operations: ["cloudflare", "infisical", "local-dev"],
      domain: "api.example.test",
    },
    requiredFiles: [
      "packages/api/package.json",
      "packages/database/package.json",
      "operations.config.json",
    ],
  },
  {
    id: "expo-max",
    flags: {
      ...baseFlags("eval-expo-max", "expo"),
      integrations: ["api", "auth", "async-storage"],
      operations: ["local-dev"],
      theme: "chalk",
    },
    requiredFiles: ["src/api/orpc.ts", "src/api/auth-client.ts", "src/utilities/storage.ts"],
  },
  {
    id: "rust-service-max",
    flags: {
      ...baseFlags("eval-rust-max", "rust"),
      integrations: ["clap", "axum", "serde"],
      operations: ["infisical", "local-dev"],
    },
    requiredFiles: ["src/cli.rs", "src/http/router.rs", "operations.config.json"],
  },
  ...(["analytics-posthog", "analytics-plausible", "analytics-fathom"] as const).map(
    (analytics) => ({
      id: analytics,
      flags: { ...baseFlags(`eval-${analytics}`, "marketing"), integrations: [analytics] },
      requiredFiles: ["src/layouts/base-layout.astro"],
    }),
  ),
  ...(["jade", "blueprint", "ion", "chalk"] as const).map((theme) => ({
    id: `theme-${theme}`,
    flags: { ...baseFlags(`eval-${theme}`, "console"), theme },
    requiredFiles: ["src/ui/theme/palette.css"],
  })),
  {
    id: "console-staging",
    flags: { ...baseFlags("eval-console-staging", "console"), staging: true },
    requiredFiles: ["wrangler.jsonc"],
  },
  {
    id: "expo-staging",
    flags: { ...baseFlags("eval-expo-staging", "expo"), staging: true },
    requiredFiles: ["eas.json", ".eas/workflows/staging-build.yml"],
  },
];

function authoredDigest(files: PlannedFile[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${file.path}\0${file.mode ?? 0o644}\0${file.content.length}\0${file.content}`);
  }
  return hash.digest("hex");
}

const goldenPath = resolve("tests/evals/scenario-goldens.json");
let goldens: Record<string, string>;
try {
  goldens = JSON.parse(await readFile(goldenPath, "utf8")) as Record<string, string>;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  goldens = {};
}

if (process.env.UPDATE_EVAL_GOLDENS === "1") {
  goldens = {};
  for (const scenario of scenarios) {
    const manifest = resolveConfiguration({ generatorVersion: "0.6.0", flags: scenario.flags });
    goldens[scenario.id] = authoredDigest(await planRecipe(manifest, resolve(".")));
  }
  await writeFile(goldenPath, `${JSON.stringify(goldens, null, 2)}\n`);
}

describe("recipe scenario evals", () => {
  test.each(scenarios)("$id meets its semantic contract and authored golden", async (scenario) => {
    const manifest = resolveConfiguration({ generatorVersion: "0.6.0", flags: scenario.flags });
    const first = await planRecipe(manifest, resolve("."));
    const second = await planRecipe(manifest, resolve("."));
    const paths = new Set(first.map((file) => file.path));

    expect(first).toEqual(second);
    for (const path of scenario.requiredFiles)
      expect(paths.has(path), `missing ${path}`).toBe(true);
    expect(paths.has("toolu.scaffold.json")).toBe(true);
    expect(first.some((file) => file.content.includes("{{TOOLU_"))).toBe(false);
    expect(authoredDigest(first)).toBe(goldens[scenario.id] ?? "missing golden");
  });
});
