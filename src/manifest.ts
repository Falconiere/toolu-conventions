import { z } from "zod";
import { INTEGRATIONS, OPERATIONS, STACKS, THEME_PRESETS, WORKSPACE_PACKAGES } from "./contracts";
import { PROJECT_NAME_PATTERN } from "./identity";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const ThemeFilePathSchema = z.enum([
  "palette.css",
  "scale.css",
  "colors.ts",
  "icons.ts",
  "motion.ts",
  "spacing.ts",
  "typography.ts",
]);
const PageSchema = z
  .string()
  .regex(/^(?:home|[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/);

const StackSchema = z.discriminatedUnion("id", [
  z.object({ id: z.literal("console") }).strict(),
  z
    .object({
      id: z.literal("marketing"),
      pages: z.array(PageSchema).min(1).refine(uniqueValues, "pages must be unique"),
    })
    .strict(),
  z
    .object({
      id: z.literal("backend-ts"),
      persistence: z.literal("turso"),
      workspace: z.boolean(),
    })
    .strict(),
  z.object({ id: z.literal("expo") }).strict(),
  z.object({ id: z.literal("rust"), mode: z.enum(["cli", "service"]) }).strict(),
]);

const ThemeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("preset"), preset: z.enum(THEME_PRESETS) }).strict(),
  z
    .object({
      kind: z.literal("import"),
      source: z.string().min(1),
      files: z
        .array(
          z
            .object({
              path: ThemeFilePathSchema,
              target: z.enum(["web", "native"]),
              sha256: Sha256Schema,
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
]);

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

const IntegrationsSchema = z
  .array(z.string())
  .refine(uniqueValues, "integrations must be unique")
  .default([]);

const AppSchema = z
  .object({
    // Also the operations service name, which must start with a letter.
    id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    stack: StackSchema,
    integrations: IntegrationsSchema,
    port: z.number().int().min(1).max(65535),
  })
  .strict();

const commonShape = {
  schemaVersion: z.literal(1),
  generatorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  project: z
    .object({
      name: z.string().regex(PROJECT_NAME_PATTERN),
      displayName: z.string().trim().min(1).max(80),
      targetDirectory: z.string().min(1),
    })
    .strict(),
  operations: z
    .array(z.enum(OPERATIONS))
    .refine(uniqueValues, "operations must be unique")
    .default([]),
  environments: z
    .array(z.enum(["local", "development", "staging", "production"]))
    .min(2)
    .refine(uniqueValues, "environments must be unique"),
  staging: z.boolean(),
  theme: ThemeSchema,
  recipes: z.array(z.string().min(1)).min(1).refine(uniqueValues, "recipes must be unique"),
};

const StandaloneManifestObject = z
  .object({
    ...commonShape,
    layout: z.literal("standalone"),
    stack: StackSchema,
    integrations: IntegrationsSchema,
    runtime: z
      .object({
        port: z.number().int().min(1).max(65535),
        domain: z.string().optional(),
        consoleUrl: z.string().url().optional(),
      })
      .strict(),
  })
  .strict();

const MonorepoManifestObject = z
  .object({
    ...commonShape,
    layout: z.literal("monorepo"),
    apps: z
      .array(AppSchema)
      .min(1)
      .refine((apps) => uniqueValues(apps.map((app) => app.id)), "app ids must be unique"),
    packages: z
      .array(z.enum(WORKSPACE_PACKAGES))
      .refine(uniqueValues, "packages must be unique")
      .default([]),
    runtime: z
      .object({
        domain: z.string().optional(),
        consoleUrl: z.string().url().optional(),
      })
      .strict(),
  })
  .strict();

/**
 * Manifests written before the layout field existed describe a single app.
 * Defaulting here keeps `--config` replay of those files working.
 */
function withDefaultLayout(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const record: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  record.layout ??= "standalone";
  return record;
}

const ScaffoldManifestUnion = z.discriminatedUnion("layout", [
  StandaloneManifestObject,
  MonorepoManifestObject,
]);

export const ScaffoldConfigurationSchema = z
  .object({
    ...commonShape,
    layout: z.enum(["standalone", "monorepo"]),
    stack: StackSchema,
    integrations: z.array(z.string()),
    apps: z.array(AppSchema),
    packages: z.array(z.enum(WORKSPACE_PACKAGES)),
    runtime: z
      .object({
        port: z.number().int().min(1).max(65535).optional(),
        domain: z.string().optional(),
        consoleUrl: z.string().url().optional(),
      })
      .strict(),
  })
  .partial()
  .strict();

function checkIntegrations(
  stackId: (typeof STACKS)[number],
  integrations: readonly string[],
  path: (string | number)[],
  context: z.core.$RefinementCtx,
): void {
  const allowed = new Set<string>(INTEGRATIONS[stackId]);
  for (const integration of integrations) {
    if (!allowed.has(integration)) {
      context.addIssue({
        code: "custom",
        path,
        message: `${integration} is not compatible with ${stackId}`,
      });
    }
  }
  if (!STACKS.includes(stackId)) {
    context.addIssue({ code: "custom", path, message: "unsupported stack" });
  }
}

export const ScaffoldManifestSchema = z
  .preprocess(withDefaultLayout, ScaffoldManifestUnion)
  .superRefine((manifest, context) => {
    if (manifest.layout === "standalone") {
      checkIntegrations(manifest.stack.id, manifest.integrations, ["integrations"], context);
    } else {
      for (const [index, app] of manifest.apps.entries()) {
        checkIntegrations(app.stack.id, app.integrations, ["apps", index, "integrations"], context);
      }
    }
    if (
      manifest.staging &&
      manifest.operations.some(
        (operation) => operation === "cloudflare" || operation === "infisical",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["staging"],
        message: "staging cannot be combined with provider operations",
      });
    }
  });

export type ScaffoldManifest = z.infer<typeof ScaffoldManifestSchema>;
export type StandaloneManifest = Extract<ScaffoldManifest, { layout: "standalone" }>;
export type MonorepoManifest = Extract<ScaffoldManifest, { layout: "monorepo" }>;
export type ManifestApp = MonorepoManifest["apps"][number];
export type ScaffoldConfiguration = z.infer<typeof ScaffoldConfigurationSchema>;

export function isMonorepo(manifest: ScaffoldManifest): manifest is MonorepoManifest {
  return manifest.layout === "monorepo";
}

export class ManifestCompatibilityError extends Error {
  override name = "ManifestCompatibilityError";
}

function versionLine(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) throw new ManifestCompatibilityError(`invalid generator version: ${version}`);
  // Before 1.0, minor releases may break replay compatibility. Stable releases
  // follow semver and retain compatibility across one major line.
  return match[1] === "0" ? `${match[1]}.${match[2]}` : (match[1] ?? "");
}

export function assertGeneratorCompatibility(
  manifestVersion: string,
  generatorVersion: string,
): void {
  if (versionLine(manifestVersion) !== versionLine(generatorVersion)) {
    throw new ManifestCompatibilityError(
      `manifest generator ${manifestVersion} is not compatible with ${generatorVersion}`,
    );
  }
}

export function parseManifest(input: unknown): ScaffoldManifest {
  return ScaffoldManifestSchema.parse(input);
}

export function parseScaffoldConfiguration(input: unknown): ScaffoldConfiguration {
  return ScaffoldConfigurationSchema.parse(input);
}
