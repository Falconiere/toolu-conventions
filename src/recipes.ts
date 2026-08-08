import { readdir, readFile, stat } from "node:fs/promises";
import { join, posix, relative, resolve, sep } from "node:path";
import { pinned, type KnownDependency } from "./dependencies";
import type { ScaffoldManifest } from "./manifest";
import { assertNoReservedPlaceholders, renderTemplate } from "./render";
import { readVerifiedImportedThemeFile } from "./theme";

export interface PlannedFile {
  path: string;
  content: string;
  mode?: number;
}

const GUARDRAIL_ITEMS = [
  "run.sh",
  "lib",
  "checks",
  "patterns",
  "schema.json",
  "workspace.schema.json",
  "oxlint-plugin",
] as const;

function projectDescription(manifest: ScaffoldManifest): string {
  return `${manifest.project.displayName} project.`;
}

function placeholderValues(manifest: ScaffoldManifest): Record<string, string> {
  const preset = manifest.theme.kind === "preset" ? manifest.theme.preset : "jade";
  return {
    TOOLU_PROJECT_NAME: manifest.project.name,
    TOOLU_DISPLAY_NAME: manifest.project.displayName,
    TOOLU_DESCRIPTION: projectDescription(manifest),
    TOOLU_STAGING_ROW: manifest.staging
      ? "| staging | pre-production validation | `bun run deploy --env staging` |"
      : "",
    TOOLU_DESIGN_NOTES:
      manifest.theme.kind === "import"
        ? `Theme tokens imported from ${manifest.theme.source}.`
        : `Theme preset: ${preset}.`,
    TOOLU_THEME_PRESET: preset,
    TOOLU_SITE_DOMAIN: manifest.runtime.domain ?? `${manifest.project.name}.example.com`,
    TOOLU_SECTION_MARKER: "01 / HOME",
    TOOLU_HEADLINE_LINE_ONE: "Build with clarity.",
    TOOLU_HEADLINE_LINE_TWO: manifest.project.displayName,
    TOOLU_SUBHEAD: projectDescription(manifest),
    TOOLU_PROJECT_SLUG: manifest.project.name,
    TOOLU_URL_SCHEME: manifest.project.name.replaceAll("-", ""),
    TOOLU_BUNDLE_ID: `com.${manifest.project.name.replaceAll("-", "")}.app`,
    TOOLU_ANDROID_PACKAGE: `com.${manifest.project.name.replaceAll("-", "")}.app`,
    TOOLU_EAS_PROJECT_ID: "00000000-0000-0000-0000-000000000000",
  };
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function portableRelative(from: string, to: string): string {
  return relative(from, to).split(sep).join(posix.sep);
}

function consoleDestination(templateRoot: string, source: string): string | undefined {
  const path = portableRelative(templateRoot, source);
  if (path === "CLAUDE.md.template") return "CLAUDE.md";
  if (path === "env.ts") return "src/constants/env.ts";
  if (path === "globals.css") return "src/ui/globals.css";
  if (path.startsWith("theme/")) return `src/ui/${path}`;
  if (path.startsWith("utilities/")) return `src/${path}`;
  if (path === "src/api/orpc.ts") return undefined;
  return path;
}

function marketingDestination(templateRoot: string, source: string): string {
  const path = portableRelative(templateRoot, source);
  if (path === "CLAUDE.md.template") return "CLAUDE.md";
  if (path === "env.ts") return "src/constants/env.ts";
  return path;
}

function backendDestination(templateRoot: string, source: string): string {
  const path = portableRelative(templateRoot, source);
  if (path === "CLAUDE.md.template") return "CLAUDE.md";
  if (path === "env.ts") return "src/constants/env.ts";
  return path;
}

function expoDestination(templateRoot: string, source: string): string | undefined {
  const path = portableRelative(templateRoot, source);
  if (path === "CLAUDE.md.template") return "CLAUDE.md";
  if (path === "folder-README.md") return undefined;
  if (path === "env.ts") return "src/constants/env.ts";
  if (path.startsWith("theme/")) return `src/ui/${path}`;
  if (path.startsWith("ui/")) return `src/${path}`;
  if (path.startsWith("features/")) return `src/${path}`;
  return path;
}

function rustDestination(templateRoot: string, source: string): string | undefined {
  const path = portableRelative(templateRoot, source);
  if (path === "CLAUDE.md.template") return "CLAUDE.md";
  if (path === "folder-README.md") return undefined;
  return path;
}

function databaseDestination(templateRoot: string, source: string): string {
  const path = portableRelative(templateRoot, source);
  return path === "CLAUDE.md.template" ? "CLAUDE.md" : path;
}

function jsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  if (!isJsonObject(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isJsonObject(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function stringRecordProperty(
  object: Record<string, unknown>,
  property: string,
): Record<string, string> {
  const value = object[property];
  if (!isStringRecord(value)) throw new Error(`${property} must contain only string values`);
  return value;
}

function objectProperty(
  object: Record<string, unknown>,
  property: string,
): Record<string, unknown> {
  return jsonObject(object[property], property);
}

function objectArrayProperty(
  object: Record<string, unknown>,
  property: string,
): Record<string, unknown>[] {
  const value = object[property];
  if (!Array.isArray(value) || !value.every(isJsonObject)) {
    throw new Error(`${property} must be an array of JSON objects`);
  }
  return value;
}

function optionalStringArrayProperty(object: Record<string, unknown>, property: string): string[] {
  const value = object[property];
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${property} must be an array of strings`);
  }
  return value;
}

function parsePlannedJson(files: Map<string, PlannedFile>, path: string): Record<string, unknown> {
  const file = files.get(path);
  if (file === undefined) throw new Error(`planned JSON file is missing: ${path}`);
  const parsed: unknown = JSON.parse(file.content);
  return jsonObject(parsed, path);
}

function setPlannedJson(files: Map<string, PlannedFile>, path: string, value: unknown): void {
  files.set(path, { path, content: jsonContent(value) });
}

function addPackageDependencies(
  files: Map<string, PlannedFile>,
  dependencies: readonly KnownDependency[],
  devDependencies: readonly KnownDependency[] = [],
  packagePath = "package.json",
): void {
  const packageFile = parsePlannedJson(files, packagePath);
  packageFile.dependencies = {
    ...stringRecordProperty(packageFile, "dependencies"),
    ...pinned(dependencies),
  };
  packageFile.devDependencies = {
    ...stringRecordProperty(packageFile, "devDependencies"),
    ...pinned(devDependencies),
  };
  setPlannedJson(files, packagePath, packageFile);
}

function consolePackage(manifest: ScaffoldManifest): string {
  const dependencies: KnownDependency[] = [
    "@fontsource-variable/archivo",
    "@fontsource-variable/jetbrains-mono",
    "@tailwindcss/vite",
    "@tanstack/react-query",
    "@tanstack/react-router",
    "react",
    "react-dom",
    "tailwindcss",
    "zod",
  ];
  const devDependencies: KnownDependency[] = [
    "@tanstack/router-plugin",
    "@testing-library/jest-dom",
    "@testing-library/react",
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "jscpd",
    "jsdom",
    "knip",
    "lefthook",
    "oxfmt",
    "oxlint",
    "oxlint-tsgolint",
    "typescript",
    "vite",
    "vite-tsconfig-paths",
    "vitest",
    "wrangler",
  ];
  return `${JSON.stringify(
    {
      name: manifest.project.name,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        deploy: "bun run build && wrangler deploy",
        "type-check": "tsc --noEmit",
        lint: "oxlint --deny-warnings",
        "lint:fix": "oxlint --fix --deny-warnings",
        fmt: "oxfmt --ignore-path .oxfmtignore",
        "fmt:check": "oxfmt --check --ignore-path .oxfmtignore",
        test: "vitest run",
        "test:watch": "vitest",
        "check:structure": "bash scripts/guardrails/run.sh",
        "check:unused": "knip --no-config-hints",
        "check:dupes": "jscpd",
        check:
          "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
        prepare: "lefthook install --force || true",
      },
      dependencies: pinned(dependencies),
      devDependencies: pinned(devDependencies),
    },
    null,
    2,
  )}\n`;
}

function marketingPackage(manifest: ScaffoldManifest): string {
  const dependencies: KnownDependency[] = [
    "@astrojs/sitemap",
    "@fontsource-variable/archivo",
    "@fontsource-variable/jetbrains-mono",
    "@tailwindcss/vite",
    "astro",
    "tailwindcss",
    "zod",
  ];
  const devDependencies: KnownDependency[] = [
    "@astrojs/check",
    "jscpd",
    "knip",
    "lefthook",
    "oxfmt",
    "oxlint",
    "oxlint-tsgolint",
    "vitest",
    "wrangler",
  ];
  return `${JSON.stringify(
    {
      name: manifest.project.name,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "astro dev",
        build: "astro build",
        preview: "astro preview",
        deploy: "bun run build && wrangler deploy",
        sync: "astro sync",
        "type-check": "astro check",
        lint: "oxlint --deny-warnings",
        "lint:fix": "oxlint --fix --deny-warnings",
        fmt: "oxfmt --ignore-path .oxfmtignore",
        "fmt:check": "oxfmt --check --ignore-path .oxfmtignore",
        test: "vitest run",
        "test:watch": "vitest",
        "check:structure": "bash scripts/guardrails/run.sh",
        "check:unused": "knip --no-config-hints",
        "check:dupes": "jscpd",
        check:
          "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
        prepare: "lefthook install --force || true",
      },
      dependencies: pinned(dependencies),
      devDependencies: { ...pinned(devDependencies), typescript: "6.0.3" },
    },
    null,
    2,
  )}\n`;
}

function backendPackage(manifest: ScaffoldManifest): string {
  const dependencies: KnownDependency[] = [
    "@orpc/server",
    "@tursodatabase/serverless",
    "hono",
    "zod",
  ];
  const devDependencies: KnownDependency[] = [
    "@cloudflare/vitest-pool-workers",
    "jscpd",
    "knip",
    "lefthook",
    "oxfmt",
    "oxlint",
    "oxlint-tsgolint",
    "typescript",
    "vitest",
    "wrangler",
  ];
  return `${JSON.stringify(
    {
      name: manifest.project.name,
      version: "0.1.0",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts", "./router": "./src/rpc/router.ts" },
      scripts: {
        dev: "wrangler dev",
        build: "wrangler deploy --dry-run --outdir dist",
        deploy: "wrangler deploy",
        "cf-typegen": "wrangler types",
        "type-check": "tsc --noEmit",
        lint: "oxlint --deny-warnings",
        "lint:fix": "oxlint --fix --deny-warnings",
        fmt: "oxfmt --ignore-path .oxfmtignore",
        "fmt:check": "oxfmt --check --ignore-path .oxfmtignore",
        "check:structure": "bash scripts/guardrails/run.sh",
        "check:unused": "knip --no-config-hints",
        "check:dupes": "jscpd",
        test: "vitest run",
        "test:watch": "vitest",
        check:
          "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
        prepare: "lefthook install --force || true",
      },
      dependencies: pinned(dependencies),
      devDependencies: pinned(devDependencies),
    },
    null,
    2,
  )}\n`;
}

function expoPackage(manifest: ScaffoldManifest): string {
  const dependencies = {
    ...pinned([
      "expo",
      "expo-constants",
      "expo-router",
      "expo-system-ui",
      "expo-updates",
      "react-native",
      "react-native-gesture-handler",
      "react-native-safe-area-context",
      "react-native-screens",
      "react-native-svg",
      "zod",
    ]),
    react: "19.0.0",
  };
  const devDependencies: KnownDependency[] = [
    "@babel/plugin-transform-class-static-block",
    "@testing-library/react-native",
    "@types/jest",
    "@types/node",
    "@types/react-test-renderer",
    "babel-preset-expo",
    "jest",
    "jest-expo",
    "jscpd",
    "knip",
    "lefthook",
    "oxfmt",
    "oxlint",
    "oxlint-tsgolint",
    "react-test-renderer",
    "typescript",
  ];
  return `${JSON.stringify(
    {
      name: manifest.project.name,
      version: "1.0.0",
      private: true,
      main: "expo-router/entry",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
        build: "expo export --platform ios --output-dir dist",
        "type-check": "tsc --noEmit",
        lint: "oxlint --deny-warnings",
        "lint:fix": "oxlint --fix --deny-warnings",
        fmt: "oxfmt --ignore-path .oxfmtignore",
        "fmt:check": "oxfmt --check --ignore-path .oxfmtignore",
        "check:structure": "bash scripts/guardrails/run.sh",
        "check:unused": "knip --no-config-hints",
        "check:dupes": "jscpd",
        test: "jest --runInBand",
        "test:watch": "jest --watch",
        check:
          "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
        prepare: "lefthook install --force || true",
      },
      dependencies,
      devDependencies: pinned(devDependencies),
    },
    null,
    2,
  )}\n`;
}

function folderReadme(path: string): string {
  const purpose = path.replace(/^src\//, "").replaceAll("/", " / ");
  return `# ${path}\n\nOwns the ${purpose} surface. Keep this inventory current as files are added.\n`;
}

function backendApplication(manifest: ScaffoldManifest, workspace: boolean): string {
  const auth = manifest.integrations.includes("auth");
  const logging = manifest.integrations.includes("structured-logging");
  const drizzle = manifest.integrations.includes("drizzle");
  return `/** The assembled Hono and oRPC application. */
import { RPCHandler } from '@orpc/server/fetch';
import { Hono } from 'hono';
${auth ? "import { auth } from '@/services/auth';\n" : ""}${
    drizzle && !workspace ? "import { createOrm } from '@/services/drizzle-service';\n" : ""
  }import { router } from '@/rpc/router';
import { createDatabase } from '@/services/database-service';
${logging ? "import { logEvent } from '@/utilities/logger';\n" : ""}
const rpc = new RPCHandler(router);

export const app = new Hono<{ Bindings: Env }>();

app.get('/health', (context) => {
  ${logging ? "logEvent('health.checked');\n  " : ""}return context.json({ status: 'ok' });
});

app.get('/database/health', async (context) => {
  ${drizzle && !workspace ? "createOrm();\n  " : ""}await ${
    workspace
      ? "createDatabase().$client.execute('select 1')"
      : drizzle
        ? "createDatabase().execute('select 1')"
        : "(await createDatabase().prepare('select 1')).get()"
  };
  return context.json({ status: 'ok' });
});
${auth ? "\napp.all('/api/auth/*', (context) => auth.handler(context.req.raw));\n" : ""}
app.all('/rpc/*', async (context) => {
  const { matched, response } = await rpc.handle(context.req.raw, {
    prefix: '/rpc',
    context: { env: context.env, headers: context.req.raw.headers },
  });
  return matched ? response : context.notFound();
});
`;
}

async function addTree(
  files: Map<string, PlannedFile>,
  sourceRoot: string,
  destinationFor: (source: string) => string | undefined,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  for (const source of await walkFiles(sourceRoot)) {
    const destination = destinationFor(source);
    if (destination === undefined) continue;
    const content = renderTemplate(await readFile(source, "utf8"), values);
    const details = await stat(source);
    files.set(destination, {
      path: destination,
      content,
      ...(details.mode & 0o111 ? { mode: 0o755 } : {}),
    });
  }
}

async function addGuardrails(files: Map<string, PlannedFile>, assetRoot: string): Promise<void> {
  for (const item of GUARDRAIL_ITEMS) {
    const source = resolve(assetRoot, "guardrails", item);
    const details = await stat(source);
    if (details.isDirectory()) {
      await addTree(
        files,
        source,
        (file) => `scripts/guardrails/${item}/${portableRelative(source, file)}`,
        {},
      );
    } else {
      const destination = `scripts/guardrails/${item}`;
      files.set(destination, {
        path: destination,
        content: await readFile(source, "utf8"),
        ...(details.mode & 0o111 ? { mode: 0o755 } : {}),
      });
    }
  }
}

function stackRuntime(manifest: ScaffoldManifest): "client" | "static" | "server" | "mixed" {
  if (manifest.stack.id === "console") {
    return manifest.integrations.includes("worker-api") ? "mixed" : "client";
  }
  if (manifest.stack.id === "marketing") {
    return manifest.integrations.includes("ssr-cloudflare") ? "server" : "static";
  }
  if (manifest.stack.id === "backend-ts") return "server";
  if (manifest.stack.id === "expo") return "client";
  return manifest.integrations.includes("axum") ? "server" : "client";
}

function serviceCommand(manifest: ScaffoldManifest): string {
  if (manifest.stack.id === "rust") return "cargo run";
  if (manifest.stack.id === "backend-ts" && manifest.stack.workspace) {
    return `bun --filter @${manifest.project.name}/api run dev`;
  }
  if (manifest.stack.id === "expo") return "bun run start";
  return "bun run dev";
}

function serviceName(manifest: ScaffoldManifest): string {
  if (manifest.stack.id === "console") return "console";
  if (manifest.stack.id === "marketing") return "site";
  if (manifest.stack.id === "expo") return "app";
  return "api";
}

function serviceRuntime(manifest: ScaffoldManifest): "client" | "static" | "server" {
  const runtime = stackRuntime(manifest);
  if (runtime === "mixed") return "server";
  return runtime;
}

async function addOperations(
  files: Map<string, PlannedFile>,
  manifest: ScaffoldManifest,
  assetRoot: string,
): Promise<void> {
  if (manifest.operations.length === 0) return;

  const sharedRoot = resolve(assetRoot, "conventions/shared/templates/scripts/operations");
  await addTree(
    files,
    sharedRoot,
    (source) => `scripts/operations/${portableRelative(sharedRoot, source)}`,
    {},
  );
  const name = serviceName(manifest);
  const runtime = serviceRuntime(manifest);
  const server = runtime === "server";
  const domain = manifest.runtime.domain ?? `${manifest.project.name}.example.com`;
  const service: Record<string, unknown> = {
    name,
    runtime,
    command: serviceCommand(manifest),
    port: manifest.runtime.port,
    ...(server
      ? {
          healthcheck: `http://127.0.0.1:${manifest.runtime.port}/${manifest.stack.id === "console" ? "api/" : ""}health`,
        }
      : {}),
    ...(manifest.operations.includes("cloudflare")
      ? { localHostname: `local-${name}.${domain}` }
      : {}),
    ...(manifest.operations.includes("infisical") ? { secretsTarget: ".dev.vars" } : {}),
  };
  const operations: Record<string, unknown> = {
    $schema: "./scripts/operations/schema.json",
    version: 1,
    stack:
      manifest.stack.id === "backend-ts" && manifest.stack.workspace
        ? "workspace"
        : manifest.stack.id,
    runtime: stackRuntime(manifest),
    environments: ["local", "development", "production"],
    services: [service],
  };

  if (manifest.operations.includes("cloudflare")) {
    operations.cloudflare = {
      zone: domain,
      tunnelName: `${manifest.project.name}-local`,
      deploy: {
        development: {
          worker: `${manifest.project.name}-dev`,
          command: "bun run deploy --env development",
        },
        production: { worker: manifest.project.name, command: "bun run deploy" },
      },
    };
    const root = resolve(assetRoot, "conventions/cloudflare-infra/templates");
    await addTree(
      files,
      resolve(root, "scripts/operations/cloudflare"),
      (source) =>
        `scripts/operations/cloudflare/${portableRelative(resolve(root, "scripts/operations/cloudflare"), source)}`,
      {},
    );
    for (const workflow of ["deploy-development.yml", "deploy-production.yml"]) {
      files.set(`.github/workflows/${workflow}`, {
        path: `.github/workflows/${workflow}`,
        content: await readFile(resolve(root, ".github/workflows", workflow), "utf8"),
      });
    }
    files.set(".env.operations.example", {
      path: ".env.operations.example",
      content: await readFile(resolve(root, ".env.operations.example"), "utf8"),
    });
  }
  if (manifest.operations.includes("infisical")) {
    operations.infisical = { secretPath: "/" };
    const root = resolve(
      assetRoot,
      "conventions/infisical-secrets/templates/scripts/operations/infisical",
    );
    await addTree(
      files,
      root,
      (source) => `scripts/operations/infisical/${portableRelative(root, source)}`,
      {},
    );
    if (!files.has(".env.operations.example")) {
      const environment = resolve(
        assetRoot,
        "conventions/infisical-secrets/templates/.env.operations.example",
      );
      files.set(".env.operations.example", {
        path: ".env.operations.example",
        content: await readFile(environment, "utf8"),
      });
    }
  }
  if (manifest.operations.includes("local-dev")) {
    const root = resolve(assetRoot, "conventions/local-dev/templates/scripts/operations/dev");
    await addTree(
      files,
      root,
      (source) => `scripts/operations/dev/${portableRelative(root, source)}`,
      {},
    );
  }
  files.set("operations.config.json", {
    path: "operations.config.json",
    content: jsonContent(operations),
  });
}

async function applyImportedTheme(
  files: Map<string, PlannedFile>,
  manifest: ScaffoldManifest,
): Promise<void> {
  if (manifest.theme.kind !== "import") return;
  for (const file of manifest.theme.files) {
    const path = `src/ui/theme/${file.path}`;
    files.set(path, {
      path,
      content: await readVerifiedImportedThemeFile(manifest.theme, file),
    });
  }
}

function cloudflareEnvironments(
  manifest: ScaffoldManifest,
  includeVars: boolean,
): Record<string, unknown> | undefined {
  const environments: Record<string, unknown> = {};
  if (manifest.operations.includes("cloudflare")) {
    environments.development = {
      name: `${manifest.project.name}-dev`,
      ...(includeVars ? { vars: { APP_ENV: "development" } } : {}),
    };
  }
  if (manifest.staging) {
    environments.staging = {
      name: `${manifest.project.name}-staging`,
      ...(includeVars ? { vars: { APP_ENV: "staging" } } : {}),
    };
  }
  return Object.keys(environments).length === 0 ? undefined : environments;
}

function applyDeploymentConfiguration(
  files: Map<string, PlannedFile>,
  manifest: ScaffoldManifest,
): void {
  if (manifest.stack.id === "console") {
    const worker = manifest.integrations.includes("worker-api");
    const environments = cloudflareEnvironments(manifest, false);
    setPlannedJson(files, "wrangler.jsonc", {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: manifest.project.name,
      compatibility_date: "2026-07-30",
      ...(worker ? { main: "./src/worker.ts" } : {}),
      assets: {
        directory: "./dist",
        ...(worker ? { binding: "ASSETS" } : {}),
        not_found_handling: "single-page-application",
      },
      ...(environments === undefined ? {} : { env: environments }),
      observability: { enabled: true },
    });
    return;
  }
  if (manifest.stack.id === "marketing") {
    const serverRendered = manifest.integrations.includes("ssr-cloudflare");
    const environments = cloudflareEnvironments(manifest, false);
    setPlannedJson(files, "wrangler.jsonc", {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: manifest.project.name,
      compatibility_date: "2026-07-30",
      ...(serverRendered
        ? { main: "./dist/_worker.js/index.js", compatibility_flags: ["nodejs_compat"] }
        : {}),
      assets: {
        directory: "./dist",
        ...(serverRendered ? { binding: "ASSETS" } : {}),
        not_found_handling: "404-page",
      },
      ...(environments === undefined ? {} : { env: environments }),
      observability: { enabled: true },
    });
    return;
  }
  if (manifest.stack.id === "backend-ts") {
    const path = manifest.stack.workspace ? "packages/api/wrangler.jsonc" : "wrangler.jsonc";
    const environments = cloudflareEnvironments(manifest, true);
    setPlannedJson(files, path, {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: manifest.project.name,
      main: "./src/index.ts",
      compatibility_date: "2026-07-30",
      compatibility_flags: ["nodejs_compat"],
      vars: { APP_ENV: "development" },
      ...(environments === undefined ? {} : { env: environments }),
      observability: { enabled: true },
    });
    return;
  }
  if (manifest.stack.id === "expo") {
    const eas = parsePlannedJson(files, "eas.json");
    const build = objectProperty(eas, "build");
    if (!manifest.staging) delete build.staging;
    setPlannedJson(files, "eas.json", eas);
    if (manifest.staging) {
      files.set(".eas/workflows/staging-build.yml", {
        path: ".eas/workflows/staging-build.yml",
        content:
          "name: Staging build\n\non:\n  workflow_dispatch: {}\n\njobs:\n  build_ios:\n    name: Build iOS (staging)\n    type: build\n    params:\n      platform: ios\n      profile: staging\n\n  build_android:\n    name: Build Android (staging)\n    type: build\n    params:\n      platform: android\n      profile: staging\n",
      });
    }
  }
}

async function planConsole(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  const templateRoot = resolve(assetRoot, "stacks/console/templates");
  const values = placeholderValues(manifest);
  await addTree(files, templateRoot, (source) => consoleDestination(templateRoot, source), values);
  files.delete("src/utilities/http.ts");
  files.set("package.json", { path: "package.json", content: consolePackage(manifest) });
  for (const path of [
    "src/ui/README.md",
    "src/features/README.md",
    "src/api/README.md",
    "src/utilities/README.md",
    "src/providers/README.md",
    "src/constants/README.md",
    "src/types/README.md",
  ]) {
    files.set(path, { path, content: folderReadme(path.replace("/README.md", "")) });
  }
  files.set("src/features/home/README.md", {
    path: "src/features/home/README.md",
    content: folderReadme("src/features/home"),
  });
  const design = await readFile(resolve(assetRoot, "DESIGN.md"), "utf8");
  files.set("docs/design-language.md", { path: "docs/design-language.md", content: design });

  if (manifest.integrations.includes("api")) {
    const apiTemplate = resolve(templateRoot, "src/api/orpc.ts");
    files.set("src/api/orpc.ts", {
      path: "src/api/orpc.ts",
      content: renderTemplate(await readFile(apiTemplate, "utf8"), values),
    });
    files.set("src/types/api-contract.ts", {
      path: "src/types/api-contract.ts",
      content:
        "/** Replace this starter with the deployed API's exported AppRouter type. */\nexport type AppRouter = Record<string, never>;\n",
    });
    addPackageDependencies(files, ["@orpc/client", "@orpc/server", "@orpc/tanstack-query"]);
  }
  if (manifest.integrations.includes("auth")) {
    files.set("src/api/auth-client.ts", {
      path: "src/api/auth-client.ts",
      content: `/** Browser authentication client. */\nimport { createAuthClient } from 'better-auth/react';\n\nexport const authClient = createAuthClient();\n`,
    });
    addPackageDependencies(files, ["better-auth"]);
  }
  if (manifest.integrations.includes("worker-api")) {
    files.set("src/worker.ts", {
      path: "src/worker.ts",
      content: `/** Same-project Worker API. */\nimport { Hono } from 'hono';\n\nconst app = new Hono();\napp.get('/api/health', (context) => context.json({ status: 'ok' }));\n\nexport default app;\n`,
    });
    const lint = parsePlannedJson(files, ".oxlintrc.json");
    const overrides = objectArrayProperty(lint, "overrides");
    overrides.push({
      files: ["src/worker.ts"],
      rules: { "import/no-default-export": "off" },
    });
    setPlannedJson(files, ".oxlintrc.json", lint);
    files.set("wrangler.jsonc", {
      path: "wrangler.jsonc",
      content: jsonContent({
        $schema: "./node_modules/wrangler/config-schema.json",
        name: manifest.project.name,
        compatibility_date: "2026-07-30",
        main: "./src/worker.ts",
        assets: {
          directory: "./dist",
          binding: "ASSETS",
          not_found_handling: "single-page-application",
        },
        observability: { enabled: true },
      }),
    });
    addPackageDependencies(files, ["hono"]);
  }
  const integrationImports = [
    ...(manifest.integrations.includes("api") ? ["import { orpc } from '@/api/orpc';"] : []),
    ...(manifest.integrations.includes("auth")
      ? ["import { authClient } from '@/api/auth-client';"]
      : []),
  ];
  const integrationValues = [
    ...(manifest.integrations.includes("api") ? ["orpc"] : []),
    ...(manifest.integrations.includes("auth") ? ["authClient"] : []),
  ];
  files.set("src/features/home/integration-status.ts", {
    path: "src/features/home/integration-status.ts",
    content: `/** Selected client integrations wired into the starter screen. */\n${integrationImports.join("\n")}${integrationImports.length > 0 ? "\n\n" : ""}export const integrationCount = ${
      integrationValues.length > 0 ? `[${integrationValues.join(", ")}].length` : "0"
    };\n`,
  });
}

function pageTitle(slug: string): string {
  return slug
    .split(/[/-]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

async function planMarketing(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  if (manifest.stack.id !== "marketing")
    throw new Error("marketing recipe requires a marketing manifest");
  const templateRoot = resolve(assetRoot, "stacks/marketing/templates");
  const values = placeholderValues(manifest);
  await addTree(
    files,
    templateRoot,
    (source) => marketingDestination(templateRoot, source),
    values,
  );

  const webThemeRoot = resolve(assetRoot, "stacks/console/templates/theme");
  await addTree(
    files,
    webThemeRoot,
    (source) => {
      const path = portableRelative(webThemeRoot, source);
      return path === "icons.ts" ? undefined : `src/ui/theme/${path}`;
    },
    values,
  );
  const globals = renderTemplate(
    await readFile(resolve(assetRoot, "stacks/console/templates/globals.css"), "utf8"),
    values,
  );
  files.set("src/ui/globals.css", { path: "src/ui/globals.css", content: globals });
  files.set("package.json", { path: "package.json", content: marketingPackage(manifest) });

  for (const path of [
    "src/layouts/README.md",
    "src/sections/README.md",
    "src/ui/README.md",
    "src/utilities/README.md",
    "src/constants/README.md",
    "src/types/README.md",
  ]) {
    files.set(path, { path, content: folderReadme(path.replace("/README.md", "")) });
  }

  for (const slug of manifest.stack.pages) {
    if (slug === "home") continue;
    const sectionStem = `${slug.replaceAll("/", "-")}-section`;
    const componentName = `${pageTitle(slug).replaceAll(" ", "")}Section`;
    const title = pageTitle(slug);
    const pagePath = `src/pages/${slug}.astro`;
    files.set(pagePath, {
      path: pagePath,
      content: `---\n/** /${slug} — generated route shell. */\nimport BaseLayout from '@/layouts/base-layout.astro';\nimport ${componentName} from '@/sections/${sectionStem}.astro';\n---\n\n<BaseLayout title="${title} — ${manifest.project.displayName}" description="${title} for ${manifest.project.displayName}.">\n  <${componentName} />\n</BaseLayout>\n`,
    });
    const sectionPath = `src/sections/${sectionStem}.astro`;
    files.set(sectionPath, {
      path: sectionPath,
      content: `---\n/** ${title} page section. */\n---\n\n<section class="band px-gutter py-section-y md:px-gutter-md xl:px-gutter-lg">\n  <div class="mx-auto max-w-page">\n    <p class="type-marker text-text-faint">${slug.toUpperCase()}</p>\n    <h1 class="type-display-lg mt-6 text-text">${title}</h1>\n  </div>\n</section>\n`,
    });
  }

  files.set("public/robots.txt", {
    path: "public/robots.txt",
    content: `User-agent: *\nAllow: /\nSitemap: https://${manifest.runtime.domain ?? `${manifest.project.name}.example.com`}/sitemap-index.xml\n`,
  });
  files.set("public/favicon.svg", {
    path: "public/favicon.svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0e0f0d"/><path d="M16 32h32" stroke="#43c98b" stroke-width="8"/></svg>\n',
  });
  const design = await readFile(resolve(assetRoot, "DESIGN.md"), "utf8");
  files.set("docs/design-language.md", { path: "docs/design-language.md", content: design });

  if (manifest.integrations.includes("blog")) {
    files.set("src/pages/blog/index.astro", {
      path: "src/pages/blog/index.astro",
      content: `---\nimport BaseLayout from '@/layouts/base-layout.astro';\n---\n\n<BaseLayout title="Blog — ${manifest.project.displayName}" description="Updates from ${manifest.project.displayName}.">\n  <main class="band px-gutter py-section-y"><h1 class="type-display-lg">Blog</h1></main>\n</BaseLayout>\n`,
    });
    files.set("src/content.config.ts", {
      path: "src/content.config.ts",
      content: `import { defineCollection } from 'astro:content';\nimport { z } from 'astro/zod';\n\nexport const collections = {\n  blog: defineCollection({ schema: z.object({ title: z.string(), publishedAt: z.date() }) }),\n};\n`,
    });
    files.set("src/content/blog/welcome.md", {
      path: "src/content/blog/welcome.md",
      content: `---\ntitle: Welcome\npublishedAt: 2026-01-01\n---\n\nThe first ${manifest.project.displayName} update.\n`,
    });
    files.set("src/content/README.md", {
      path: "src/content/README.md",
      content: "# Content\n\nEach child directory is a validated Astro content collection.\n",
    });
    const lint = parsePlannedJson(files, ".oxlintrc.json");
    const overrides = objectArrayProperty(lint, "overrides");
    overrides.push({
      files: ["src/content.config.ts"],
      rules: {
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
      },
    });
    setPlannedJson(files, ".oxlintrc.json", lint);
  }
  if (manifest.integrations.includes("changelog")) {
    files.set("src/pages/changelog/index.astro", {
      path: "src/pages/changelog/index.astro",
      content: `---\nimport BaseLayout from '@/layouts/base-layout.astro';\n---\n\n<BaseLayout title="Changelog — ${manifest.project.displayName}" description="Product changes from ${manifest.project.displayName}.">\n  <main class="band px-gutter py-section-y"><h1 class="type-display-lg">Changelog</h1></main>\n</BaseLayout>\n`,
    });
  }
  if (manifest.integrations.includes("react-island")) {
    files.set("src/ui/signup-island.tsx", {
      path: "src/ui/signup-island.tsx",
      content: `/** An opt-in hydrated island. */\nimport { useState } from 'react';\n\nexport function SignupIsland() {\n  const [submitted, setSubmitted] = useState(false);\n  return <button type="button" onClick={() => setSubmitted(true)}>{submitted ? 'Thanks' : 'Join updates'}</button>;\n}\n`,
    });
    files.set("src/pages/index.astro", {
      path: "src/pages/index.astro",
      content: `---\n/** Home page with one opt-in hydrated React island. */\nimport BaseLayout from '@/layouts/base-layout.astro';\nimport HeroSection from '@/sections/hero-section.astro';\nimport { SignupIsland } from '@/ui/signup-island';\n---\n\n<BaseLayout title="${manifest.project.displayName}" description="${projectDescription(manifest)}">\n  <HeroSection />\n  <SignupIsland client:visible />\n</BaseLayout>\n`,
    });
    addPackageDependencies(
      files,
      ["@astrojs/react", "react", "react-dom"],
      ["@types/react", "@types/react-dom"],
    );
  }
  if (manifest.integrations.includes("ssr-cloudflare")) {
    addPackageDependencies(files, ["@astrojs/cloudflare"]);
  }
  const needsCloudflare = manifest.integrations.includes("ssr-cloudflare");
  const needsReact = manifest.integrations.includes("react-island");
  if (needsCloudflare || needsReact) {
    const imports = [
      "import { defineConfig } from 'astro/config';",
      "import sitemap from '@astrojs/sitemap';",
      "import tailwindcss from '@tailwindcss/vite';",
      ...(needsCloudflare ? ["import cloudflare from '@astrojs/cloudflare';"] : []),
      ...(needsReact ? ["import react from '@astrojs/react';"] : []),
    ];
    const integrations = ["sitemap()", ...(needsReact ? ["react()"] : [])];
    files.set("astro.config.mjs", {
      path: "astro.config.mjs",
      content: `// @ts-check\n${imports.join("\n")}\n\nconst site = process.env.SITE_URL ?? 'https://${manifest.runtime.domain ?? `${manifest.project.name}.example.com`}';\n\nexport default defineConfig({\n  site,\n  output: '${needsCloudflare ? "server" : "static"}',\n  ${needsCloudflare ? "adapter: cloudflare(),\n  " : ""}integrations: [${integrations.join(", ")}],\n  vite: { plugins: [tailwindcss()] },\n  build: { format: 'directory' },\n  trailingSlash: 'ignore',\n});\n`,
    });
  }

  const layout = files.get("src/layouts/base-layout.astro");
  if (layout !== undefined) {
    const analytics = manifest.integrations.includes("analytics-posthog")
      ? `    <script>\n      import posthog from 'posthog-js';\n      posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, { api_host: 'https://us.i.posthog.com' });\n    </script>\n`
      : manifest.integrations.includes("analytics-plausible")
        ? `    <script defer data-domain="${manifest.runtime.domain ?? manifest.project.name}" src="https://plausible.io/js/script.js"></script>\n`
        : manifest.integrations.includes("analytics-fathom")
          ? '    <script src="https://cdn.usefathom.com/script.js" data-site="SITE_ID" defer></script>\n'
          : "";
    if (analytics.length > 0) {
      layout.content = layout.content.replace("  </head>", `${analytics}  </head>`);
    }
  }
  if (manifest.integrations.includes("analytics-posthog"))
    addPackageDependencies(files, ["posthog-js"]);
}

async function planBackend(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  const templateRoot = resolve(assetRoot, "stacks/backend-ts/templates");
  const values = placeholderValues(manifest);
  await addTree(files, templateRoot, (source) => backendDestination(templateRoot, source), values);
  files.set("package.json", { path: "package.json", content: backendPackage(manifest) });
  for (const path of [
    "src/rpc/README.md",
    "src/routes/README.md",
    "src/services/README.md",
    "src/utilities/README.md",
    "src/constants/README.md",
    "src/types/README.md",
  ]) {
    files.set(path, { path, content: folderReadme(path.replace("/README.md", "")) });
  }
  if (manifest.integrations.includes("auth")) {
    files.set("src/services/auth.ts", {
      path: "src/services/auth.ts",
      content: `/** Better Auth server instance. */\nimport { betterAuth } from 'better-auth';\n\nexport const auth = betterAuth({});\n`,
    });
    addPackageDependencies(files, ["better-auth"]);
  }
  if (manifest.integrations.includes("structured-logging")) {
    files.set("src/utilities/logger.ts", {
      path: "src/utilities/logger.ts",
      content: `/** Writes one structured event per line. */\nexport function logEvent(event: string, fields: Readonly<Record<string, unknown>> = {}): void {\n  console.info(JSON.stringify({ event, ...fields }));\n}\n`,
    });
    const lint = parsePlannedJson(files, ".oxlintrc.json");
    const overrides = objectArrayProperty(lint, "overrides");
    overrides.push({ files: ["src/utilities/logger.ts"], rules: { "no-console": "off" } });
    setPlannedJson(files, ".oxlintrc.json", lint);
  }
  if (manifest.integrations.includes("drizzle")) {
    const workspace = manifest.stack.id === "backend-ts" && manifest.stack.workspace;
    if (!workspace) {
      const packageFile = parsePlannedJson(files, "package.json");
      const dependencies = stringRecordProperty(packageFile, "dependencies");
      delete dependencies["@tursodatabase/serverless"];
      Object.assign(dependencies, pinned(["@libsql/client"]));
      setPlannedJson(files, "package.json", packageFile);
      files.set("src/services/database-service.ts", {
        path: "src/services/database-service.ts",
        content: `/** Request-scoped Turso client used by Drizzle. */\nimport { createClient } from '@libsql/client/web';\nimport { tursoConfig } from '@/constants/env';\n\nexport function createDatabase() {\n  return createClient(tursoConfig());\n}\n`,
      });
    }
    files.set("src/services/drizzle-service.ts", {
      path: "src/services/drizzle-service.ts",
      content: `/** Creates a Drizzle facade over the request-scoped Turso client. */\nimport { drizzle } from 'drizzle-orm/libsql';\nimport { createDatabase } from '@/services/database-service';\n\nexport function createOrm() {\n  return drizzle(createDatabase());\n}\n`,
    });
    addPackageDependencies(files, ["drizzle-orm"]);
  }
  if (
    manifest.integrations.some((integration) =>
      ["auth", "structured-logging", "drizzle"].includes(integration),
    )
  ) {
    const workspace = manifest.stack.id === "backend-ts" && manifest.stack.workspace;
    files.set("src/app.ts", {
      path: "src/app.ts",
      content: backendApplication(manifest, workspace),
    });
  }
}

async function planBackendWorkspace(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  const apiFiles = new Map<string, PlannedFile>();
  await planBackend(manifest, assetRoot, apiFiles);
  const apiPackage = parsePlannedJson(apiFiles, "package.json");
  const apiDependencies = stringRecordProperty(apiPackage, "dependencies");
  delete apiDependencies["@tursodatabase/serverless"];
  apiDependencies[`@${manifest.project.name}/database`] = "workspace:*";
  delete apiDependencies["drizzle-orm"];
  apiPackage.name = `@${manifest.project.name}/api`;
  const apiScripts = stringRecordProperty(apiPackage, "scripts");
  apiScripts["check:structure"] = "bash ../../scripts/guardrails/run.sh";
  apiScripts.fmt = "oxfmt --ignore-path ../../.oxfmtignore";
  apiScripts["fmt:check"] = "oxfmt --check --ignore-path ../../.oxfmtignore";
  setPlannedJson(apiFiles, "package.json", apiPackage);
  apiFiles.set("src/services/database-service.ts", {
    path: "src/services/database-service.ts",
    content: `/** Request-scoped database shared by API services. */\nimport { createDatabase as createClient } from '@${manifest.project.name}/database/client';\nimport { tursoConfig } from '@/constants/env';\n\nexport function createDatabase() {\n  return createClient(tursoConfig());\n}\n`,
  });
  apiFiles.delete("src/services/drizzle-service.ts");

  for (const file of apiFiles.values()) {
    if (file.path.startsWith(".github/") || file.path === "lefthook.yml") continue;
    const destination = `packages/api/${file.path}`;
    const content = file.content;
    files.set(destination, { ...file, path: destination, content });
  }

  for (const packagePath of [
    "packages/api/base.oxlintrc.json",
    "packages/api/guardrails.config.json",
  ]) {
    const config = parsePlannedJson(files, packagePath);
    if (packagePath.endsWith("base.oxlintrc.json")) {
      config.jsPlugins = ["./../../scripts/guardrails/oxlint-plugin/index.js"];
    } else {
      config.$schema = "./../../scripts/guardrails/schema.json";
    }
    setPlannedJson(files, packagePath, config);
  }
  const apiKnip = parsePlannedJson(files, "packages/api/knip.json");
  apiKnip.ignoreDependencies = [
    ...optionalStringArrayProperty(apiKnip, "ignoreDependencies"),
    `@${manifest.project.name}/database`,
  ];
  setPlannedJson(files, "packages/api/knip.json", apiKnip);

  const databaseRoot = resolve(assetRoot, "stacks/database-ts/templates");
  const values = placeholderValues(manifest);
  await addTree(
    files,
    databaseRoot,
    (source) => `packages/database/${databaseDestination(databaseRoot, source)}`,
    values,
  );
  const databasePackage = {
    name: `@${manifest.project.name}/database`,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: {
      "./client": "./src/client/create-database.ts",
      "./schema": "./src/schema/tables.ts",
      "./types": "./src/types/database.ts",
    },
    scripts: {
      check:
        "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
      "type-check": "tsc --noEmit",
      lint: "oxlint --type-aware --deny-warnings",
      "fmt:check": "oxfmt --check . --ignore-path ../../.oxfmtignore",
      "check:structure": "bash ../../scripts/guardrails/run.sh",
      "check:unused": "knip --no-config-hints",
      "check:dupes": "jscpd",
      test: "vitest run",
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
    },
    dependencies: pinned(["@libsql/client", "drizzle-orm", "zod"]),
    devDependencies: pinned([
      "@cloudflare/vitest-pool-workers",
      "drizzle-kit",
      "jscpd",
      "knip",
      "oxfmt",
      "oxlint",
      "oxlint-tsgolint",
      "typescript",
      "vitest",
      "wrangler",
    ]),
  };
  setPlannedJson(files, "packages/database/package.json", databasePackage);
  for (const packagePath of [
    "packages/database/base.oxlintrc.json",
    "packages/database/guardrails.config.json",
  ]) {
    const config = parsePlannedJson(files, packagePath);
    if (packagePath.endsWith("base.oxlintrc.json")) {
      config.jsPlugins = ["./../../scripts/guardrails/oxlint-plugin/index.js"];
    } else {
      config.$schema = "./../../scripts/guardrails/schema.json";
    }
    setPlannedJson(files, packagePath, config);
  }

  const workspaceRoot = resolve(assetRoot, "shared/workspace");
  const workspaceMappings: Record<string, string> = {
    "guardrails.workspace.json": "guardrails.workspace.json",
    "knip.json": "knip.json",
    "lefthook.yml": "lefthook.yml",
    "ci.yml": ".github/workflows/ci.yml",
    "code-review.yml": ".github/workflows/code-review.yml",
  };
  for (const [sourceName, destination] of Object.entries(workspaceMappings)) {
    files.set(destination, {
      path: destination,
      content: renderTemplate(await readFile(resolve(workspaceRoot, sourceName), "utf8"), values),
    });
  }
  setPlannedJson(files, "knip.json", {
    $schema: "./node_modules/knip/schema.json",
    ignoreExportsUsedInFile: true,
    workspaces: {
      ".": { entry: [], project: [] },
      "packages/api": {
        project: ["src/**/*.ts"],
        ignore: ["src/constants/env.ts"],
        ignoreDependencies: ["cloudflare:workers"],
      },
      "packages/database": {
        entry: [
          "src/client/create-database.ts",
          "src/schema/tables.ts",
          "src/types/database.ts",
          "drizzle.config.ts",
        ],
        project: ["src/**/*.ts"],
        ignoreDependencies: ["cloudflare", "cloudflare:test", "wrangler"],
      },
    },
  });
  setPlannedJson(files, "package.json", {
    name: manifest.project.name,
    private: true,
    type: "module",
    workspaces: ["packages/*"],
    scripts: {
      check: "bun run check:structure && bun run check:unused && bun run --filter '*' check",
      "type-check": "bun run --filter '*' type-check",
      lint: "bun run --filter '*' lint",
      "fmt:check": "bun run --filter '*' fmt:check",
      fmt: "oxfmt --ignore-path .oxfmtignore",
      "check:structure": "bash scripts/guardrails/run.sh",
      "check:unused": "knip --no-config-hints",
      "check:dupes": "bun run --filter '*' check:dupes",
      test: "bun run --filter '*' test",
      prepare: "lefthook install --force || true",
    },
    devDependencies: pinned(["knip", "lefthook", "oxfmt"]),
  });
}

async function planExpo(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  const templateRoot = resolve(assetRoot, "stacks/expo/templates");
  const values = placeholderValues(manifest);
  await addTree(files, templateRoot, (source) => expoDestination(templateRoot, source), values);
  files.delete("src/utilities/http.ts");
  files.set("package.json", { path: "package.json", content: expoPackage(manifest) });
  for (const path of [
    "src/ui/README.md",
    "src/features/README.md",
    "src/api/README.md",
    "src/utilities/README.md",
    "src/providers/README.md",
    "src/constants/README.md",
    "src/types/README.md",
    "assets/README.md",
  ]) {
    files.set(path, { path, content: folderReadme(path.replace("/README.md", "")) });
  }
  files.set("src/features/home/README.md", {
    path: "src/features/home/README.md",
    content: folderReadme("src/features/home"),
  });
  const design = await readFile(resolve(assetRoot, "DESIGN.md"), "utf8");
  files.set("docs/design-language.md", { path: "docs/design-language.md", content: design });
  if (manifest.integrations.includes("api")) {
    files.set("src/types/api-contract.ts", {
      path: "src/types/api-contract.ts",
      content:
        "/** Replace this starter with the deployed API's exported AppRouter type. */\nexport type AppRouter = Record<string, never>;\n",
    });
    files.set("src/api/orpc.ts", {
      path: "src/api/orpc.ts",
      content: `/** Typed transport for the application API. */\nimport { createORPCClient } from '@orpc/client';\nimport { RPCLink } from '@orpc/client/fetch';\nimport { BASE_API_URL } from '@/constants/env';\nimport type { AppRouter } from '@/types/api-contract';\n\nconst link = new RPCLink({ url: \`${"${BASE_API_URL}"}/rpc\` });\nexport const api = createORPCClient<AppRouter>(link);\n`,
    });
    addPackageDependencies(files, ["@orpc/client"]);
  }
  if (manifest.integrations.includes("auth")) {
    files.set("src/api/auth-client.ts", {
      path: "src/api/auth-client.ts",
      content: `/** Mobile authentication client with SecureStore-backed credentials. */\nimport * as SecureStore from 'expo-secure-store';\nimport { createAuthClient } from 'better-auth/react';\n\nexport const authClient = createAuthClient({\n  fetchOptions: {\n    auth: {\n      type: 'Bearer',\n      token: async () => (await SecureStore.getItemAsync('session-token')) ?? undefined,\n    },\n  },\n});\n`,
    });
    addPackageDependencies(files, ["better-auth", "expo-secure-store"]);
  }
  if (manifest.integrations.includes("async-storage")) {
    files.set("src/utilities/storage.ts", {
      path: "src/utilities/storage.ts",
      content: `/** Non-sensitive persistent device storage. */\nimport AsyncStorage from '@react-native-async-storage/async-storage';\n\nexport const storage = AsyncStorage;\n`,
    });
    addPackageDependencies(files, ["@react-native-async-storage/async-storage"]);
  }
  const integrationImports = [
    ...(manifest.integrations.includes("api") ? ["import { api } from '@/api/orpc';"] : []),
    ...(manifest.integrations.includes("auth")
      ? ["import { authClient } from '@/api/auth-client';"]
      : []),
    ...(manifest.integrations.includes("async-storage")
      ? ["import { storage } from '@/utilities/storage';"]
      : []),
  ];
  const integrationValues = [
    ...(manifest.integrations.includes("api") ? ["api"] : []),
    ...(manifest.integrations.includes("auth") ? ["authClient"] : []),
    ...(manifest.integrations.includes("async-storage") ? ["storage"] : []),
  ];
  files.set("src/features/home/integration-status.ts", {
    path: "src/features/home/integration-status.ts",
    content: `${integrationImports.join("\n")}${integrationImports.length > 0 ? "\n\n" : ""}/** Number of optional clients wired into this starter. */\nexport const integrationCount = ${
      integrationValues.length > 0 ? `[${integrationValues.join(", ")}].length` : "0"
    };\n`,
  });
}

async function planRust(
  manifest: ScaffoldManifest,
  assetRoot: string,
  files: Map<string, PlannedFile>,
) {
  const templateRoot = resolve(assetRoot, "stacks/rust/templates");
  const values = placeholderValues(manifest);
  await addTree(files, templateRoot, (source) => rustDestination(templateRoot, source), values);
  const templateCargo = await readFile(resolve(templateRoot, "Cargo.toml"), "utf8");
  const lintStart = templateCargo.indexOf("# House lints.");
  const dependencies: string[] = [];
  if (manifest.integrations.includes("clap")) {
    dependencies.push('clap = { version = "=4.6.6", features = ["derive"] }');
  }
  if (manifest.integrations.includes("axum")) {
    dependencies.push(
      'axum = "=0.8.9"',
      'tokio = { version = "=1.53.1", features = ["macros", "net", "rt-multi-thread"] }',
    );
  }
  if (manifest.integrations.includes("serde")) {
    dependencies.push(
      'serde = { version = "=1.0.229", features = ["derive"] }',
      'serde_json = "=1.0.151"',
    );
  }
  files.set("Cargo.toml", {
    path: "Cargo.toml",
    content: `[package]\nname = "${manifest.project.name}"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n${dependencies.join("\n")}\n\n${templateCargo.slice(lintStart)}`,
  });

  if (manifest.integrations.includes("clap")) {
    const serviceFields = manifest.integrations.includes("axum")
      ? "    /// TCP port for the HTTP service.\n    #[arg(long, default_value_t = 3000)]\n    pub(crate) port: u16,"
      : '    /// Name included in the greeting.\n    #[arg(long, default_value = "world")]\n    pub(crate) name: String,';
    files.set("src/cli.rs", {
      path: "src/cli.rs",
      content: `//! Command-line interface.\n\nuse clap::Parser;\n\n/// Process arguments.\n#[derive(Debug, Parser)]\n#[command(version, about)]\npub(crate) struct Cli {\n${serviceFields}\n}\n`,
    });
  }

  if (manifest.integrations.includes("axum")) {
    files.delete("src/greeting.rs");
    files.delete("src/tests/greeting.rs");
    files.set("src/http.rs", {
      path: "src/http.rs",
      content: "//! HTTP service modules.\n\npub(crate) mod router;\n",
    });
    const healthHandler = manifest.integrations.includes("serde")
      ? `use axum::{Json, Router, routing::get};\nuse serde::Serialize;\n\n#[derive(Serialize)]\nstruct HealthResponse {\n    status: &'static str,\n}\n\nasync fn health() -> Json<HealthResponse> {\n    Json(HealthResponse { status: "ok" })\n}`
      : 'async fn health() -> &\'static str {\n    "ok"\n}';
    files.set("src/http/router.rs", {
      path: "src/http/router.rs",
      content: `//! HTTP router and health endpoint.\n\n${
        manifest.integrations.includes("serde") ? "" : "use axum::{Router, routing::get};\n"
      }${healthHandler}\n\n/// Builds the service router.\npub(crate) fn app() -> Router {\n    Router::new().route("/health", get(health))\n}\n`,
    });
    const cliImports = manifest.integrations.includes("clap")
      ? "mod cli;\nmod http;\n\nuse clap::Parser;\nuse cli::Cli;\n"
      : "mod http;\n";
    const port = manifest.integrations.includes("clap") ? "Cli::parse().port" : "3000";
    files.set("src/main.rs", {
      path: "src/main.rs",
      content: `//! Binary entry point for \`${manifest.project.name}\`.\n\n${cliImports}\n/// Starts the HTTP service.\n#[tokio::main]\nasync fn main() {\n    let address = (std::net::Ipv4Addr::LOCALHOST, ${port});\n    let listener = match tokio::net::TcpListener::bind(address).await {\n        Ok(listener) => listener,\n        Err(error) => {\n            eprintln!("failed to bind HTTP listener: {error}");\n            return;\n        }\n    };\n    if let Err(error) = axum::serve(listener, http::router::app()).await {\n        eprintln!("HTTP service failed: {error}");\n    }\n}\n`,
    });
  } else if (manifest.integrations.includes("clap")) {
    files.set("src/main.rs", {
      path: "src/main.rs",
      content: `//! Binary entry point for \`${manifest.project.name}\`.\n\nmod cli;\nmod greeting;\n\nuse clap::Parser;\nuse cli::Cli;\nuse greeting::greeting;\n\n/// Program entry point.\nfn main() {\n    let cli = Cli::parse();\n    println!("{}", greeting(&cli.name));\n}\n`,
    });
  }
}

export async function planRecipe(
  manifest: ScaffoldManifest,
  assetRoot: string,
): Promise<PlannedFile[]> {
  const files = new Map<string, PlannedFile>();
  if (manifest.stack.id === "console") await planConsole(manifest, assetRoot, files);
  else if (manifest.stack.id === "marketing") await planMarketing(manifest, assetRoot, files);
  else if (manifest.stack.id === "backend-ts" && manifest.stack.workspace) {
    await planBackendWorkspace(manifest, assetRoot, files);
  } else if (manifest.stack.id === "backend-ts") await planBackend(manifest, assetRoot, files);
  else if (manifest.stack.id === "expo") await planExpo(manifest, assetRoot, files);
  else if (manifest.stack.id === "rust") await planRust(manifest, assetRoot, files);
  else throw new Error("recipe not implemented");
  applyDeploymentConfiguration(files, manifest);
  await applyImportedTheme(files, manifest);
  await addOperations(files, manifest, assetRoot);
  await addGuardrails(files, assetRoot);

  const hooksPath = resolve(assetRoot, "shared/.claude/settings.json");
  files.set(".claude/settings.json", {
    path: ".claude/settings.json",
    content: await readFile(hooksPath, "utf8"),
  });
  files.set(".gitignore", {
    path: ".gitignore",
    content:
      manifest.stack.id === "rust"
        ? "/target/\n.env\n.tooling/\n"
        : "node_modules/\ndist/\n.env*\n!.env.example\n.dev.vars\n.tooling/\n",
  });
  if (manifest.stack.id !== "rust") {
    files.set(".oxfmtignore", {
      path: ".oxfmtignore",
      content: "*.md\n.astro/**\n.wrangler/**\nscripts/guardrails/**\nsrc/ui/theme/**\n",
    });
  }
  files.set("toolu.scaffold.json", {
    path: "toolu.scaffold.json",
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  });

  const planned = [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
  for (const file of planned) assertNoReservedPlaceholders(file.content, file.path);
  return planned;
}
