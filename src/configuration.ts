import {
  DEFAULT_APP_DIRECTORIES,
  LAYOUTS,
  THEME_PRESETS,
  WORKSPACE_PACKAGES,
  type AppFlags,
  type LayoutId,
  type ResolutionFlags,
  type StackId,
  type WorkspacePackageId,
} from "./contracts";
import { isStackId, validateCompatibility, visualStack } from "./compatibility";
import { titleCaseProjectName } from "./identity";
import {
  parseManifest,
  type ManifestApp,
  type ScaffoldConfiguration,
  type ScaffoldManifest,
} from "./manifest";

export class MissingInputsError extends Error {
  override name = "MissingInputsError";

  constructor(readonly missing: readonly string[]) {
    super(`Missing required options: ${missing.join(", ")}`);
  }
}

export interface ResolveConfigurationOptions {
  generatorVersion: string;
  flags: ResolutionFlags;
  config?: ScaffoldConfiguration;
}

export function resolveLayout(flags: ResolutionFlags, config?: ScaffoldConfiguration): LayoutId {
  const value = flags.layout ?? config?.layout ?? "standalone";
  const layout = LAYOUTS.find((candidate) => candidate === value);
  if (layout === undefined) throw new Error(`Unsupported layout: ${value}`);
  return layout;
}

export function missingRequiredInputs(
  flags: ResolutionFlags,
  config?: ScaffoldConfiguration,
): string[] {
  const missing: string[] = [];
  if (flags.targetDirectory === undefined && config?.project?.targetDirectory === undefined)
    missing.push("<target>");
  if (resolveLayout(flags, config) === "monorepo") {
    const apps = flags.apps ?? config?.apps ?? [];
    if (apps.length === 0) missing.push("--app");
  } else if (flags.stack === undefined && config?.stack?.id === undefined) {
    missing.push("--stack");
  }
  if (flags.name === undefined && config?.project?.name === undefined) missing.push("--name");
  return missing;
}

function defaultPort(stack: StackId): number {
  switch (stack) {
    case "console":
      return 5173;
    case "marketing":
      return 4321;
    case "backend-ts":
      return 8787;
    case "expo":
      return 8081;
    case "rust":
      return 3000;
  }
}

function stackFor(
  stack: StackId,
  integrations: readonly string[],
  pages: readonly string[],
  workspace: boolean,
): ManifestApp["stack"] {
  if (stack === "marketing") return { id: stack, pages: [...pages] };
  if (stack === "backend-ts") return { id: stack, persistence: "turso", workspace };
  if (stack === "rust")
    return { id: stack, mode: integrations.includes("axum") ? "service" : "cli" };
  return { id: stack };
}

function recipesFor(
  stack: StackId,
  integrations: readonly string[],
  operations: readonly string[],
  workspace: boolean,
  theme: ScaffoldManifest["theme"],
) {
  return [
    `stack/${stack}`,
    ...(workspace ? ["stack/database-ts", "workspace/bun"] : []),
    ...integrations.map((integration) => `integration/${stack}/${integration}`),
    ...operations.map((operation) => `operation/${operation}`),
    ...themeRecipes(theme),
  ];
}

function themeRecipes(theme: ScaffoldManifest["theme"]): string[] {
  if (theme.kind === "preset") return [`theme/preset/${theme.preset}`];
  if (theme.kind === "import") {
    return [...new Set(theme.files.map((file) => `theme/import/${file.target}`))];
  }
  return [];
}

function monorepoRecipes(
  apps: readonly ManifestApp[],
  packages: readonly WorkspacePackageId[],
  operations: readonly string[],
  theme: ScaffoldManifest["theme"],
): string[] {
  return [
    "layout/monorepo",
    "workspace/bun",
    ...apps.flatMap((app) => [
      `app/${app.id}/stack/${app.stack.id}`,
      ...app.integrations.map((integration) => `app/${app.id}/integration/${integration}`),
    ]),
    ...packages.map((entry) => `package/${entry}`),
    ...operations.map((operation) => `operation/${operation}`),
    ...themeRecipes(theme),
  ];
}

function themeFor(
  visual: boolean,
  flags: ResolutionFlags,
  config?: ScaffoldConfiguration,
): ScaffoldManifest["theme"] {
  if (!visual) return { kind: "none" };
  if (flags.themeFrom !== undefined) {
    throw new CompatibilityErrorForSyncTheme();
  }
  if (flags.theme !== undefined) {
    const preset = THEME_PRESETS.find((candidate) => candidate === flags.theme);
    if (preset === undefined) throw new Error(`Unsupported theme preset: ${flags.theme}`);
    return { kind: "preset", preset };
  }
  if (config?.theme !== undefined && config.theme.kind !== "none") return config.theme;
  return { kind: "preset", preset: "jade" };
}

class CompatibilityErrorForSyncTheme extends Error {
  constructor() {
    super("--theme-from is resolved asynchronously by the CLI before project generation");
  }
}

function environmentsFor(
  operations: readonly string[],
  staging: boolean,
): ScaffoldManifest["environments"] {
  const providerOperations = operations.some(
    (operation) => operation === "cloudflare" || operation === "infisical",
  );
  if (providerOperations) return ["local", "development", "production"];
  return staging ? ["development", "staging", "production"] : ["development", "production"];
}

function resolvePackages(
  flags: ResolutionFlags,
  config: ScaffoldConfiguration | undefined,
  apps: readonly AppFlags[],
): WorkspacePackageId[] {
  const requested = flags.packages ?? config?.packages ?? [];
  const packages: WorkspacePackageId[] = [];
  for (const entry of requested) {
    const known = WORKSPACE_PACKAGES.find((candidate) => candidate === entry);
    if (known === undefined) throw new Error(`Unsupported package: ${entry}`);
    if (!packages.includes(known)) packages.push(known);
  }
  // A backend app that asks for the database package implies the package, and a
  // selected database package implies the wiring on the backend app. Keeping
  // both directions here means neither prompt order can produce a dangling half.
  const wiredBackend = apps.some(
    (app) => app.stack === "backend-ts" && (app.integrations ?? []).includes("database-package"),
  );
  if (wiredBackend && !packages.includes("database")) packages.push("database");
  return packages;
}

function requestedApps(
  flags: ResolutionFlags,
  config: ScaffoldConfiguration | undefined,
): AppFlags[] {
  if (flags.apps !== undefined) return flags.apps;
  return (config?.apps ?? []).map((app) => ({
    id: app.id,
    stack: app.stack.id,
    integrations: app.integrations,
    ...(app.stack.id === "marketing" ? { pages: app.stack.pages } : {}),
    port: app.port,
  }));
}

/**
 * Ports the user typed, reserved before defaults are handed out so a default
 * never lands on one. Two apps asking for the same port is a mistake to report,
 * not one to silently resolve.
 */
function explicitPorts(requested: readonly AppFlags[]): Map<string, number> {
  const ports = new Map<string, number>();
  for (const app of requested) {
    if (app.port === undefined) continue;
    const owner = [...ports.entries()].find(([, port]) => port === app.port);
    if (owner !== undefined) {
      throw new Error(`Duplicate app port: ${app.port} is requested by ${owner[0]} and ${app.id}`);
    }
    ports.set(app.id, app.port);
  }
  return ports;
}

function resolveApps(
  requested: readonly AppFlags[],
  packages: readonly WorkspacePackageId[],
): ManifestApp[] {
  const reserved = explicitPorts(requested);
  const usedPorts = new Set<number>(reserved.values());
  const apps: ManifestApp[] = [];
  for (const app of requested) {
    if (!isStackId(app.stack)) throw new Error(`Unsupported stack: ${app.stack}`);
    if (app.pages !== undefined && app.stack !== "marketing") {
      throw new Error(`Routes are a marketing stack feature: ${app.id} is ${app.stack}`);
    }
    const integrations = [...(app.integrations ?? [])];
    if (
      app.stack === "backend-ts" &&
      packages.includes("database") &&
      !integrations.includes("database-package")
    ) {
      integrations.push("drizzle", "database-package");
    }
    const id = app.id === "" ? DEFAULT_APP_DIRECTORIES[app.stack] : app.id;
    if (apps.some((existing) => existing.id === id)) {
      throw new Error(`Duplicate app directory: ${id}`);
    }
    let port = app.port ?? defaultPort(app.stack);
    while (app.port === undefined && usedPorts.has(port)) port += 1;
    usedPorts.add(port);
    apps.push({
      id,
      stack: stackFor(
        app.stack,
        integrations,
        app.pages ?? ["home"],
        app.stack === "backend-ts" && integrations.includes("database-package"),
      ),
      integrations: [...new Set(integrations)],
      port,
    });
  }
  return apps;
}

function resolveMonorepo(options: ResolveConfigurationOptions): ScaffoldManifest {
  const { flags, config } = options;
  const targetDirectory = flags.targetDirectory ?? config?.project?.targetDirectory ?? "";
  const name = flags.name ?? config?.project?.name ?? "";
  const displayName =
    flags.displayName ?? config?.project?.displayName ?? titleCaseProjectName(name);
  const requested = requestedApps(flags, config);
  const packages = resolvePackages(flags, config, requested);
  const apps = resolveApps(requested, packages);
  const operations = flags.operations ?? config?.operations ?? [];
  const staging = flags.staging ?? config?.staging ?? false;
  const theme = themeFor(
    apps.some((app) => visualStack(app.stack.id)),
    flags,
    config,
  );
  const domain = flags.domain ?? config?.runtime?.domain;
  const consoleUrl = flags.consoleUrl ?? config?.runtime?.consoleUrl;

  const manifest = parseManifest({
    schemaVersion: 1,
    generatorVersion: options.generatorVersion,
    layout: "monorepo",
    project: { name, displayName, targetDirectory },
    apps,
    packages,
    operations,
    environments: environmentsFor(operations, staging),
    staging,
    theme,
    runtime: {
      ...(domain === undefined ? {} : { domain }),
      ...(consoleUrl === undefined ? {} : { consoleUrl }),
    },
    recipes: monorepoRecipes(apps, packages, operations, theme),
  });
  validateCompatibility(manifest);
  return manifest;
}

export function resolveConfiguration(options: ResolveConfigurationOptions): ScaffoldManifest {
  const missing = missingRequiredInputs(options.flags, options.config);
  if (missing.length > 0) throw new MissingInputsError(missing);
  if (resolveLayout(options.flags, options.config) === "monorepo") {
    return resolveMonorepo(options);
  }

  const targetDirectory =
    options.flags.targetDirectory ?? options.config?.project?.targetDirectory ?? "";
  const name = options.flags.name ?? options.config?.project?.name ?? "";
  const displayName =
    options.flags.displayName ?? options.config?.project?.displayName ?? titleCaseProjectName(name);
  const stackValue = options.flags.stack ?? options.config?.stack?.id ?? "";
  if (!isStackId(stackValue)) throw new Error(`Unsupported stack: ${stackValue}`);

  const integrations = options.flags.integrations ?? options.config?.integrations ?? [];
  const operations = options.flags.operations ?? options.config?.operations ?? [];
  const staging = options.flags.staging ?? options.config?.staging ?? false;
  const pages = options.flags.pages ??
    (options.config?.stack?.id === "marketing" ? options.config.stack.pages : undefined) ?? [
      "home",
    ];
  const workspace =
    stackValue === "backend-ts" &&
    (integrations.includes("database-package") ||
      (options.config?.stack?.id === "backend-ts" && options.config.stack.workspace));

  const stack = stackFor(stackValue, integrations, pages, workspace);
  const theme = themeFor(visualStack(stackValue), options.flags, options.config);

  const rawManifest = {
    schemaVersion: 1,
    generatorVersion: options.generatorVersion,
    layout: "standalone",
    project: { name, displayName, targetDirectory },
    stack,
    integrations,
    operations,
    environments: environmentsFor(operations, staging),
    staging,
    theme,
    runtime: {
      port: options.flags.port ?? options.config?.runtime?.port ?? defaultPort(stackValue),
      ...((options.flags.domain ?? options.config?.runtime?.domain)
        ? { domain: options.flags.domain ?? options.config?.runtime?.domain }
        : {}),
      ...((options.flags.consoleUrl ?? options.config?.runtime?.consoleUrl)
        ? { consoleUrl: options.flags.consoleUrl ?? options.config?.runtime?.consoleUrl }
        : {}),
    },
    recipes: recipesFor(stackValue, integrations, operations, workspace, theme),
  };
  const manifest = parseManifest(rawManifest);
  validateCompatibility(manifest);
  return manifest;
}

export function withResolvedTheme(
  manifest: ScaffoldManifest,
  theme: Extract<ScaffoldManifest["theme"], { kind: "import" }>,
): ScaffoldManifest {
  const importRecipes = [...new Set(theme.files.map((file) => `theme/import/${file.target}`))];
  return parseManifest({
    ...manifest,
    theme,
    recipes: [
      ...manifest.recipes.filter((recipe) => !recipe.startsWith("theme/")),
      ...importRecipes,
    ],
  });
}
