import { INTEGRATIONS, OPERATIONS, STACKS, THEME_PRESETS, type StackId } from "./contracts";
import type { ScaffoldManifest } from "./manifest";

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

export function validateCompatibility(manifest: ScaffoldManifest): void {
  const { stack, integrations, operations, staging, theme } = manifest;
  assertUnique(integrations, "integrations");
  assertUnique(operations, "operations");
  if (stack.id === "marketing") assertUnique(stack.pages, "pages");

  const allowedIntegrations = new Set<string>(INTEGRATIONS[stack.id]);
  const unsupported = integrations.filter((integration) => !allowedIntegrations.has(integration));
  if (unsupported.length > 0) {
    throw new CompatibilityError(
      `${stack.id} does not support integration${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}`,
    );
  }

  const unsupportedOperations = operations.filter(
    (operation) => !OPERATIONS.some((candidate) => candidate === operation),
  );
  if (unsupportedOperations.length > 0) {
    throw new CompatibilityError(`unsupported operations: ${unsupportedOperations.join(", ")}`);
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
  if (
    stack.id === "console" &&
    operations.includes("infisical") &&
    !integrations.includes("worker-api")
  ) {
    throw new CompatibilityError("console Infisical operations require worker-api");
  }
  if (stack.id === "marketing" && operations.includes("infisical")) {
    throw new CompatibilityError("marketing does not have a server-runtime target for Infisical");
  }
  if (stack.id === "expo" && operations.some((operation) => operation !== "local-dev")) {
    throw new CompatibilityError("Expo supports only local-dev operations");
  }
  if (stack.id === "rust") {
    if (operations.includes("cloudflare")) {
      throw new CompatibilityError("Rust projects do not support Cloudflare Worker operations");
    }
    if (
      operations.some((operation) => operation === "infisical" || operation === "local-dev") &&
      !integrations.includes("axum")
    ) {
      throw new CompatibilityError("Rust Infisical and local-dev operations require axum");
    }
  }
  if (
    staging &&
    operations.some((operation) => operation === "cloudflare" || operation === "infisical")
  ) {
    throw new CompatibilityError("staging cannot be combined with provider operations");
  }

  const visualStack = stack.id === "console" || stack.id === "marketing" || stack.id === "expo";
  if (!visualStack && theme.kind !== "none") {
    throw new CompatibilityError(`${stack.id} does not support themes`);
  }
  if (theme.kind === "preset" && !THEME_PRESETS.some((preset) => preset === theme.preset)) {
    throw new CompatibilityError(`unsupported theme preset: ${theme.preset}`);
  }
  if (theme.kind === "import") {
    const expected =
      stack.id === "expo"
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
        `${stack.id} theme import must contain exactly: ${expected.paths.join(", ")}`,
      );
    }
  }
}
