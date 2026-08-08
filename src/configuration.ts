import type { ResolutionFlags, StackId, ThemePreset } from "./contracts";
import { isStackId, validateCompatibility } from "./compatibility";
import { parseManifest, type ScaffoldManifest } from "./manifest";

export class MissingInputsError extends Error {
  override name = "MissingInputsError";

  constructor(readonly missing: readonly string[]) {
    super(`Missing required options: ${missing.join(", ")}`);
  }
}

export interface ResolveConfigurationOptions {
  generatorVersion: string;
  flags: ResolutionFlags;
  config?: Partial<ScaffoldManifest>;
}

export function missingRequiredInputs(
  flags: ResolutionFlags,
  config?: Partial<ScaffoldManifest>,
): string[] {
  const missing: string[] = [];
  if (flags.targetDirectory === undefined && config?.project?.targetDirectory === undefined)
    missing.push("<target>");
  if (flags.stack === undefined && config?.stack?.id === undefined) missing.push("--stack");
  if (flags.name === undefined && config?.project?.name === undefined) missing.push("--name");
  return missing;
}

function titleCaseProjectName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
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
    ...(theme.kind === "preset"
      ? [`theme/preset/${theme.preset}`]
      : theme.kind === "import"
        ? [...new Set(theme.files.map((file) => `theme/import/${file.target}`))]
        : []),
  ];
}

function themeFor(
  stack: StackId,
  flags: ResolutionFlags,
  config?: Partial<ScaffoldManifest>,
): ScaffoldManifest["theme"] {
  const visualStack = stack === "console" || stack === "marketing" || stack === "expo";
  if (!visualStack) return { kind: "none" };
  if (flags.themeFrom !== undefined) {
    throw new CompatibilityErrorForSyncTheme();
  }
  if (flags.theme !== undefined) return { kind: "preset", preset: flags.theme as ThemePreset };
  if (config?.theme !== undefined && config.theme.kind !== "none") return config.theme;
  return { kind: "preset", preset: "jade" };
}

class CompatibilityErrorForSyncTheme extends Error {
  constructor() {
    super(
      "--theme-from must be resolved with resolveImportedTheme before configuration resolution",
    );
  }
}

export function resolveConfiguration(options: ResolveConfigurationOptions): ScaffoldManifest {
  const missing = missingRequiredInputs(options.flags, options.config);
  if (missing.length > 0) throw new MissingInputsError(missing);

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

  const stack: ScaffoldManifest["stack"] =
    stackValue === "marketing"
      ? { id: stackValue, pages }
      : stackValue === "backend-ts"
        ? { id: stackValue, persistence: "turso", workspace }
        : stackValue === "rust"
          ? { id: stackValue, mode: integrations.includes("axum") ? "service" : "cli" }
          : { id: stackValue };

  const providerOperations = operations.some(
    (operation) => operation === "cloudflare" || operation === "infisical",
  );
  const environments: ScaffoldManifest["environments"] = providerOperations
    ? ["local", "development", "production"]
    : staging
      ? ["development", "staging", "production"]
      : ["development", "production"];
  const theme = themeFor(stackValue, options.flags, options.config);

  const rawManifest = {
    schemaVersion: 1,
    generatorVersion: options.generatorVersion,
    project: { name, displayName, targetDirectory },
    stack,
    integrations,
    operations,
    environments,
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
