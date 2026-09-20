import { INTEGRATIONS, OPERATIONS, STACKS, THEME_PRESETS, type StackId } from "./contracts";
import type { ManifestApp, ScaffoldManifest } from "./manifest";

export class CompatibilityError extends Error {
  override name = "CompatibilityError";
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new CompatibilityError(`${label} must not contain duplicates`);
  }
}

export function isStackId(value: string): value is StackId {
  return STACKS.some((stack) => stack === value);
}

export function visualStack(stack: StackId): boolean {
  return stack === "console" || stack === "marketing" || stack === "expo";
}

export interface AppSurface {
  stack: ManifestApp["stack"];
  integrations: readonly string[];
}

function validateAppSurface(app: AppSurface): void {
  const { stack, integrations } = app;
  assertUnique(integrations, "integrations");
  if (stack.id === "marketing") assertUnique(stack.pages, "pages");

  const allowedIntegrations = new Set<string>(INTEGRATIONS[stack.id]);
  const unsupported = integrations.filter((integration) => !allowedIntegrations.has(integration));
  if (unsupported.length > 0) {
    throw new CompatibilityError(
      `${stack.id} does not support integration${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}`,
    );
  }

  const analytics = integrations.filter((integration) => integration.startsWith("analytics-"));
  if (analytics.length > 1) {
    throw new CompatibilityError("marketing supports only one analytics integration");
  }

  if (
    stack.id === "backend-ts" &&
    integrations.includes("database-package") &&
    !integrations.includes("drizzle")
  ) {
    throw new CompatibilityError(
      "backend-ts database-package requires drizzle and Turso persistence",
    );
  }
}

function validateOperationSet(operations: readonly string[]): void {
  assertUnique(operations, "operations");
  const unsupportedOperations = operations.filter(
    (operation) => !OPERATIONS.some((candidate) => candidate === operation),
  );
  if (unsupportedOperations.length > 0) {
    throw new CompatibilityError(`unsupported operations: ${unsupportedOperations.join(", ")}`);
  }
}

/** Why one app cannot host an operations module, or undefined when it can. */
export function operationBlocker(app: AppSurface, operation: string): string | undefined {
  const { stack, integrations } = app;
  if (stack.id === "console" && operation === "infisical" && !integrations.includes("worker-api")) {
    return "console Infisical operations require worker-api";
  }
  if (stack.id === "marketing" && operation === "infisical") {
    return "marketing does not have a server-runtime target for Infisical";
  }
  if (stack.id === "expo" && operation !== "local-dev") {
    return "Expo supports only local-dev operations";
  }
  if (stack.id === "rust") {
    if (operation === "cloudflare") {
      return "Rust projects do not support Cloudflare Worker operations";
    }
    if (
      (operation === "infisical" || operation === "local-dev") &&
      !integrations.includes("axum")
    ) {
      return "Rust Infisical and local-dev operations require axum";
    }
  }
  return undefined;
}

function validateTheme(
  theme: ScaffoldManifest["theme"],
  target: "web" | "native" | "none",
  label: string,
): void {
  if (target === "none") {
    if (theme.kind !== "none") {
      throw new CompatibilityError(`${label} does not support themes`);
    }
    return;
  }
  if (theme.kind === "preset" && !THEME_PRESETS.some((preset) => preset === theme.preset)) {
    throw new CompatibilityError(`unsupported theme preset: ${theme.preset}`);
  }
  if (theme.kind !== "import") return;
  const expected =
    target === "native"
      ? {
          target: "native",
          paths: ["colors.ts", "icons.ts", "motion.ts", "spacing.ts", "typography.ts"],
        }
      : { target: "web", paths: ["palette.css", "scale.css"] };
  const exactSurface =
    theme.files.length === expected.paths.length &&
    expected.paths.every((path) =>
      theme.files.some((file) => file.path === path && file.target === expected.target),
    );
  if (!exactSurface) {
    throw new CompatibilityError(
      `${label} theme import must contain exactly: ${expected.paths.join(", ")}`,
    );
  }
}

function validateStaging(manifest: ScaffoldManifest): void {
  if (
    manifest.staging &&
    manifest.operations.some((operation) => operation === "cloudflare" || operation === "infisical")
  ) {
    throw new CompatibilityError("staging cannot be combined with provider operations");
  }
}

function validateMonorepo(manifest: Extract<ScaffoldManifest, { layout: "monorepo" }>): void {
  assertUnique(
    manifest.apps.map((app) => app.id),
    "app directories",
  );
  for (const app of manifest.apps) validateAppSurface(app);
  validateOperationSet(manifest.operations);
  for (const operation of manifest.operations) {
    // In a workspace an operations module is wired to the services that can
    // host it. It only fails when no app in the repo can.
    const hosts = manifest.apps.filter((app) => operationBlocker(app, operation) === undefined);
    if (hosts.length === 0) {
      const reasons = new Set(
        manifest.apps
          .map((app) => operationBlocker(app, operation))
          .filter((reason): reason is string => reason !== undefined),
      );
      throw new CompatibilityError(
        `no app in this workspace can host the ${operation} operations module: ${[...reasons].join("; ")}`,
      );
    }
  }
  validateStaging(manifest);

  const targets = new Set(
    manifest.apps
      .filter((app) => visualStack(app.stack.id))
      .map((app) => (app.stack.id === "expo" ? "native" : "web")),
  );
  if (manifest.theme.kind === "import" && targets.size > 1) {
    throw new CompatibilityError(
      "a workspace with both web and native apps cannot share an imported theme; use a preset",
    );
  }
  const [target] = [...targets];
  const themed = manifest.apps.find((app) => visualStack(app.stack.id));
  validateTheme(
    manifest.theme,
    target === "native" ? "native" : target === "web" ? "web" : "none",
    themed?.stack.id ?? "this workspace",
  );
}

export function validateCompatibility(manifest: ScaffoldManifest): void {
  if (manifest.layout === "monorepo") {
    validateMonorepo(manifest);
    return;
  }
  const { stack, integrations, operations, theme } = manifest;
  validateAppSurface({ stack, integrations });
  validateOperationSet(operations);
  for (const operation of operations) {
    const blocker = operationBlocker({ stack, integrations }, operation);
    if (blocker !== undefined) throw new CompatibilityError(blocker);
  }
  validateStaging(manifest);
  validateTheme(
    theme,
    visualStack(stack.id) ? (stack.id === "expo" ? "native" : "web") : "none",
    stack.id,
  );
}
