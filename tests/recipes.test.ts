import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../src/configuration";
import { parseManifest } from "../src/manifest";
import { planRecipe } from "../src/recipes";
import { resolveImportedTheme } from "../src/theme";

describe("planRecipe", () => {
  test("materializes a complete console base from owned assets", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-console", name: "acme-console", stack: "console" },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = files.find((file) => file.path === "package.json");
    const homeScreen = files.find(
      (file) => file.path === "src/features/home/screens/home-screen.tsx",
    );

    expect(paths).toContain("src/providers/app-providers.tsx");
    expect(paths).toContain("src/features/home/screens/home-screen.tsx");
    expect(paths).toContain("src/route-tree.gen.ts");
    expect(paths).toContain("scripts/guardrails/run.sh");
    expect(paths).toContain(".claude/settings.json");
    expect(paths).toContain("toolu.scaffold.json");
    expect(JSON.parse(packageFile?.content ?? "{}")).toMatchObject({
      name: "acme-console",
      private: true,
      dependencies: { react: "19.1.1", zod: "4.4.3" },
    });
    expect(homeScreen?.content).toContain("Hello from {'Acme Console'}");
    expect(files.some((file) => file.content.includes("{{TOOLU_"))).toBe(false);
  });

  test("layers the complete console API, auth, and Worker API surface", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-console",
        name: "acme-console",
        stack: "console",
        integrations: ["api", "auth", "worker-api"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    );

    expect(paths).toContain("src/api/orpc.ts");
    expect(paths).toContain("src/api/auth-client.ts");
    expect(paths).toContain("src/worker.ts");
    expect(packageFile.dependencies).toMatchObject({
      "@orpc/client": "1.14.15",
      "@orpc/tanstack-query": "1.14.15",
      "better-auth": "1.6.26",
      hono: "4.13.1",
    });
  });

  test("generates deterministic marketing route shells from validated slugs", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-site",
        name: "acme-site",
        stack: "marketing",
        pages: ["home", "pricing", "about/team"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);

    expect(paths).toContain("src/pages/index.astro");
    expect(paths).toContain("src/pages/404.astro");
    expect(paths).toContain("src/pages/pricing.astro");
    expect(paths).toContain("src/pages/about/team.astro");
    expect(paths).toContain("src/sections/about-team-section.astro");
  });

  test.each([
    ["analytics-posthog", "posthog-js", "posthog.init"],
    ["analytics-plausible", undefined, "plausible.io/js/script.js"],
    ["analytics-fathom", undefined, "cdn.usefathom.com/script.js"],
  ])("materializes the %s analytics recipe", async (integration, dependency, marker) => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-site",
        name: "acme-site",
        stack: "marketing",
        integrations: [integration],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const packageFile = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    );
    const layout =
      files.find((file) => file.path === "src/layouts/base-layout.astro")?.content ?? "";

    expect(layout).toContain(marker);
    if (dependency !== undefined) expect(packageFile.dependencies).toHaveProperty(dependency);
  });

  test("layers blog, changelog, Cloudflare SSR, and a React island onto marketing", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-site",
        name: "acme-site",
        stack: "marketing",
        integrations: ["blog", "changelog", "ssr-cloudflare", "react-island"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    );
    const astroConfig = files.find((file) => file.path === "astro.config.mjs")?.content ?? "";

    expect(paths).toContain("src/pages/blog/index.astro");
    expect(paths).toContain("src/pages/changelog/index.astro");
    expect(paths).toContain("src/ui/signup-island.tsx");
    expect(astroConfig).toContain("@astrojs/cloudflare");
    expect(astroConfig).toContain("@astrojs/react");
    expect(packageFile.dependencies).toMatchObject({
      "@astrojs/cloudflare": "12.6.9",
      "@astrojs/react": "4.4.2",
    });
  });

  test("materializes a backend with its default Turso persistence wired", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-api", name: "acme-api", stack: "backend-ts" },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = files.find((file) => file.path === "package.json");

    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/services/database-service.ts");
    expect(paths).toContain("wrangler.jsonc");
    expect(JSON.parse(packageFile?.content ?? "{}").dependencies).toMatchObject({
      "@tursodatabase/serverless": "1.4.0",
      hono: "4.13.1",
    });
  });

  test("layers backend auth, structured logging, and Drizzle", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-api",
        name: "acme-api",
        stack: "backend-ts",
        integrations: ["auth", "structured-logging", "drizzle"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    );

    expect(paths).toContain("src/services/auth.ts");
    expect(paths).toContain("src/utilities/logger.ts");
    expect(paths).toContain("src/services/drizzle-service.ts");
    expect(packageFile.dependencies).toMatchObject({
      "better-auth": "1.6.26",
      "drizzle-orm": "0.45.2",
    });
  });

  test("materializes the backend and database as a Bun workspace", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-platform",
        name: "acme-platform",
        stack: "backend-ts",
        integrations: ["drizzle", "database-package"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const rootPackage = files.find((file) => file.path === "package.json");

    expect(paths).toContain("guardrails.workspace.json");
    expect(paths).toContain("packages/api/package.json");
    expect(paths).toContain("packages/database/package.json");
    expect(paths).toContain("packages/database/src/schema/tables.ts");
    expect(JSON.parse(rootPackage?.content ?? "{}").workspaces).toEqual(["packages/*"]);
  });

  test("materializes an owned Expo project without an upstream scaffolder", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-mobile", name: "acme-mobile", stack: "expo" },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = files.find((file) => file.path === "package.json");
    const appConfig = files.find((file) => file.path === "app.config.ts");

    expect(paths).toContain("app/_layout.tsx");
    expect(paths).toContain("src/ui/icon.tsx");
    expect(JSON.parse(packageFile?.content ?? "{}").dependencies).toMatchObject({
      expo: "53.0.22",
      react: "19.0.0",
      "react-native": "0.79.6",
    });
    expect(appConfig?.content).toContain("const IOS_BUNDLE = IS_PROD ? 'com.acmemobile.app'");
    expect(appConfig?.content).not.toContain("<project-");
  });

  test("layers Expo API, auth, and async storage integrations", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-mobile",
        name: "acme-mobile",
        stack: "expo",
        integrations: ["api", "auth", "async-storage"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const packageFile = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    );

    expect(paths).toContain("src/api/orpc.ts");
    expect(paths).toContain("src/api/auth-client.ts");
    expect(paths).toContain("src/utilities/storage.ts");
    expect(paths).toContain("src/features/home/integration-status.ts");
    expect(
      files.find((file) => file.path === "src/features/home/integration-status.ts")?.content,
    ).toContain("import { storage } from '@/utilities/storage'");
    expect(
      files.find((file) => file.path === "src/features/home/screens/home-screen.tsx")?.content,
    ).toContain("integrationCount");
    expect(packageFile.dependencies).toMatchObject({
      "@orpc/client": "1.14.15",
      "@react-native-async-storage/async-storage": "2.1.2",
      "better-auth": "1.6.26",
      "expo-secure-store": "14.2.4",
    });
  });

  test("copies an exact compatible imported theme into the authored project", async () => {
    const themeDirectory = await mkdtemp(join(tmpdir(), "toolu-theme-"));
    const themeFiles = ["colors.ts", "icons.ts", "motion.ts", "spacing.ts", "typography.ts"];
    for (const path of themeFiles) {
      const content = (await Bun.file(resolve("stacks/expo/templates/theme", path)).text()).replace(
        "{{TOOLU_THEME_PRESET}}",
        "ion",
      );
      await writeFile(join(themeDirectory, path), content);
    }
    const base = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-mobile", name: "acme-mobile", stack: "expo" },
    });
    const imported = await resolveImportedTheme(themeDirectory, "expo");
    const manifest = parseManifest({ ...base, theme: imported });

    try {
      const files = await planRecipe(manifest, resolve("."));
      const colors = files.find((file) => file.path === "src/ui/theme/colors.ts")?.content;

      expect(colors).toBe(await Bun.file(resolve(imported.source, "colors.ts")).text());
    } finally {
      await rm(themeDirectory, { recursive: true });
    }
  });

  test("materializes selected staging environments into deployment configuration", async () => {
    const consoleManifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-console",
        name: "acme-console",
        stack: "console",
        staging: true,
      },
    });
    const expoManifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-mobile",
        name: "acme-mobile",
        stack: "expo",
        staging: true,
      },
    });

    const consoleFiles = await planRecipe(consoleManifest, resolve("."));
    const consoleWrangler = JSON.parse(
      consoleFiles.find((file) => file.path === "wrangler.jsonc")?.content ?? "{}",
    );
    const expoFiles = await planRecipe(expoManifest, resolve("."));
    const eas = JSON.parse(expoFiles.find((file) => file.path === "eas.json")?.content ?? "{}");

    expect(consoleWrangler.env.staging.name).toBe("acme-console-staging");
    expect(eas.build.staging.env.EXPO_PUBLIC_ENV).toBe("staging");
    expect(expoFiles.map((file) => file.path)).toContain(".eas/workflows/staging-build.yml");
  });

  test("omits optional staging profiles and emits Cloudflare development configuration", async () => {
    const expoManifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-mobile", name: "acme-mobile", stack: "expo" },
    });
    const backendManifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-api",
        name: "acme-api",
        stack: "backend-ts",
        operations: ["cloudflare"],
      },
    });

    const expoFiles = await planRecipe(expoManifest, resolve("."));
    const eas = JSON.parse(expoFiles.find((file) => file.path === "eas.json")?.content ?? "{}");
    const backendFiles = await planRecipe(backendManifest, resolve("."));
    const wrangler = JSON.parse(
      backendFiles.find((file) => file.path === "wrangler.jsonc")?.content ?? "{}",
    );

    expect(eas.build).not.toHaveProperty("staging");
    expect(expoFiles.map((file) => file.path)).not.toContain(".eas/workflows/staging-build.yml");
    expect(wrangler.env.development).toEqual({
      name: "acme-api-dev",
      vars: { APP_ENV: "development" },
    });
  });

  test("derives operations topology and materializes all selected operation modules", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-api",
        name: "acme-api",
        stack: "backend-ts",
        operations: ["cloudflare", "infisical", "local-dev"],
        domain: "example.test",
        port: 9898,
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const paths = files.map((file) => file.path);
    const operations = JSON.parse(
      files.find((file) => file.path === "operations.config.json")?.content ?? "{}",
    );

    expect(paths).toContain("scripts/operations/validate-config.sh");
    expect(paths).toContain("scripts/operations/cloudflare/deploy.sh");
    expect(paths).toContain("scripts/operations/infisical/download.sh");
    expect(paths).toContain("scripts/operations/dev/start.sh");
    expect(operations).toMatchObject({
      version: 1,
      stack: "backend-ts",
      runtime: "server",
      services: [
        {
          name: "api",
          command: "bun run dev",
          port: 9898,
          healthcheck: "http://127.0.0.1:9898/health",
          localHostname: "local-api.example.test",
          secretsTarget: ".dev.vars",
        },
      ],
    });
  });

  test("materializes a zero-dependency Rust base with the rendered crate name", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-cli", name: "acme-cli", stack: "rust" },
    });

    const files = await planRecipe(manifest, resolve("."));
    const cargo = files.find((file) => file.path === "Cargo.toml");

    expect(files.map((file) => file.path)).toContain("src/tests/greeting.rs");
    expect(cargo?.content).toContain('name = "acme-cli"');
    expect(cargo?.content).toContain("[dependencies]\n\n");
  });

  test("layers exact clap, axum, and serde recipes onto Rust", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-service",
        name: "acme-service",
        stack: "rust",
        integrations: ["clap", "axum", "serde"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const cargo = files.find((file) => file.path === "Cargo.toml")?.content ?? "";

    expect(files.map((file) => file.path)).toContain("src/http/router.rs");
    expect(cargo).toContain('clap = { version = "=4.6.6", features = ["derive"] }');
    expect(cargo).toContain('axum = "=0.8.9"');
    expect(cargo).toContain('serde_json = "=1.0.151"');
  });

  test("generates a valid plain-text health handler for Axum without Serde", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "plain-service",
        name: "plain-service",
        stack: "rust",
        integrations: ["axum"],
      },
    });

    const files = await planRecipe(manifest, resolve("."));
    const router = files.find((file) => file.path === "src/http/router.rs")?.content ?? "";

    expect(router).toContain("async fn health() -> &'static str");
  });
});
