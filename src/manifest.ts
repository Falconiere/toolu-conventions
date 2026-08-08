import { z } from "zod";
import { INTEGRATIONS, OPERATIONS, STACKS, THEME_PRESETS } from "./contracts";

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

const ScaffoldManifestObject = z
  .object({
    schemaVersion: z.literal(1),
    generatorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    project: z
      .object({
        name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        displayName: z.string().trim().min(1).max(80),
        targetDirectory: z.string().min(1),
      })
      .strict(),
    stack: StackSchema,
    integrations: z
      .array(z.string())
      .refine(uniqueValues, "integrations must be unique")
      .default([]),
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
    runtime: z
      .object({
        port: z.number().int().min(1).max(65535),
        domain: z.string().optional(),
        consoleUrl: z.string().url().optional(),
      })
      .strict(),
    recipes: z.array(z.string().min(1)).min(1).refine(uniqueValues, "recipes must be unique"),
  })
  .strict();

export const ScaffoldConfigurationSchema = ScaffoldManifestObject.partial();

export const ScaffoldManifestSchema = ScaffoldManifestObject.superRefine((manifest, context) => {
  const allowed = new Set<string>(INTEGRATIONS[manifest.stack.id]);
  for (const integration of manifest.integrations) {
    if (!allowed.has(integration)) {
      context.addIssue({
        code: "custom",
        path: ["integrations"],
        message: `${integration} is not compatible with ${manifest.stack.id}`,
      });
    }
  }
  if (!STACKS.includes(manifest.stack.id)) {
    context.addIssue({ code: "custom", path: ["stack"], message: "unsupported stack" });
  }
  if (
    manifest.staging &&
    manifest.operations.some((operation) => operation === "cloudflare" || operation === "infisical")
  ) {
    context.addIssue({
      code: "custom",
      path: ["staging"],
      message: "staging cannot be combined with provider operations",
    });
  }
});

export type ScaffoldManifest = z.infer<typeof ScaffoldManifestSchema>;
export type ScaffoldConfiguration = z.infer<typeof ScaffoldConfigurationSchema>;

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
