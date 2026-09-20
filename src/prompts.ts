import * as clack from "@clack/prompts";
import {
  DEFAULT_APP_DIRECTORIES,
  INTEGRATIONS,
  OPERATIONS,
  STACKS,
  THEME_PRESETS,
  WORKSPACE_PACKAGES,
  type AppFlags,
  type ResolutionFlags,
  type StackId,
} from "./contracts";
import type { GenerationPhase, PlannedCommand } from "./engine";
import { PROJECT_NAME_PATTERN, PROJECT_NAME_RULE } from "./identity";

export class PromptCancelledError extends Error {
  override name = "PromptCancelledError";
}

const APP_DIRECTORY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const PACKAGE_HINTS: Record<(typeof WORKSPACE_PACKAGES)[number], string> = {
  database: "Turso + Drizzle schema package",
  ui: "shared React components",
  config: "shared oxlint bases",
  types: "shared zod contracts",
};

function accepted<T extends boolean | string | string[]>(value: T | symbol): T {
  if (typeof value === "symbol") throw new PromptCancelledError("Project creation cancelled.");
  return value;
}

function stackOperations(stack: StackId, integrations: readonly string[]): readonly string[] {
  if (stack === "marketing") return ["cloudflare", "local-dev"];
  if (stack === "expo") return ["local-dev"];
  if (stack === "rust") return integrations.includes("axum") ? ["infisical", "local-dev"] : [];
  if (stack === "console" && !integrations.includes("worker-api")) {
    return ["cloudflare", "local-dev"];
  }
  return OPERATIONS;
}

function operationChoices(flags: ResolutionFlags): readonly string[] {
  if (flags.apps !== undefined) {
    // A workspace wires each module to the apps that can host it, so the union
    // is what can be offered.
    const hosted = new Set<string>();
    for (const app of flags.apps) {
      const stack = STACKS.find((candidate) => candidate === app.stack);
      if (stack === undefined) continue;
      for (const operation of stackOperations(stack, app.integrations ?? [])) hosted.add(operation);
    }
    return OPERATIONS.filter((operation) => hosted.has(operation));
  }
  const stack = STACKS.find((candidate) => candidate === flags.stack);
  if (stack === undefined) return OPERATIONS;
  return stackOperations(stack, flags.integrations ?? []);
}

async function askIntegrations(stack: StackId, label?: string): Promise<string[]> {
  return accepted<string[]>(
    await clack.multiselect<string>({
      message: label === undefined ? "Select integrations" : `Select integrations for ${label}`,
      options: INTEGRATIONS[stack].map((integration) => ({
        value: integration,
        label: integration,
        ...(integration.startsWith("analytics-")
          ? { hint: "Choose at most one analytics provider" }
          : {}),
      })),
      required: false,
    }),
  );
}

async function askPages(label?: string): Promise<string[]> {
  const input = accepted<string>(
    await clack.text({
      message:
        label === undefined ? "Routes (comma separated)" : `Routes for ${label} (comma separated)`,
      placeholder: "home, pricing, about/team",
      defaultValue: "home",
    }),
  );
  return input
    .split(",")
    .map((page) => page.trim())
    .filter(Boolean);
}

async function askApps(): Promise<AppFlags[]> {
  const stacks = accepted<string[]>(
    await clack.multiselect<string>({
      message: "Which apps should the workspace contain?",
      options: STACKS.map((stack) => ({
        value: stack,
        label: stack,
        hint: `apps/${DEFAULT_APP_DIRECTORIES[stack]}`,
      })),
      required: true,
    }),
  );
  const apps: AppFlags[] = [];
  for (const value of stacks) {
    const stack = STACKS.find((candidate) => candidate === value);
    if (stack === undefined) throw new Error(`Unsupported stack: ${value}`);
    const id = accepted<string>(
      await clack.text({
        message: `Directory for the ${stack} app`,
        placeholder: DEFAULT_APP_DIRECTORIES[stack],
        defaultValue: DEFAULT_APP_DIRECTORIES[stack],
        validate: (input) => {
          const candidate = (input ?? "").trim() || DEFAULT_APP_DIRECTORIES[stack];
          if (!APP_DIRECTORY_PATTERN.test(candidate)) {
            return "Start with a letter; use lowercase letters, numbers, and single hyphens.";
          }
          return apps.some((app) => app.id === candidate)
            ? `apps/${candidate} is already taken.`
            : undefined;
        },
      }),
    );
    const integrations = await askIntegrations(stack, `apps/${id}`);
    apps.push({
      id,
      stack,
      integrations,
      ...(stack === "marketing" ? { pages: await askPages(`apps/${id}`) } : {}),
    });
  }
  return apps;
}

export async function collectInteractiveFlags(initial: ResolutionFlags): Promise<ResolutionFlags> {
  const flags: ResolutionFlags = { ...initial };
  clack.intro("@toolu/create");
  const targetDirectory =
    flags.targetDirectory ??
    accepted<string>(
      await clack.text({
        message: "Where should the project be created?",
        placeholder: "my-project",
        validate: (value) =>
          (value ?? "").trim().length === 0 ? "Enter a new target directory." : undefined,
      }),
    );
  flags.targetDirectory = targetDirectory;
  flags.layout ??= accepted<string>(
    await clack.select<string>({
      message: "How should the project be laid out?",
      options: [
        { value: "standalone", label: "standalone app", hint: "one stack at the repository root" },
        { value: "monorepo", label: "monorepo", hint: "apps/* and packages/* in one workspace" },
      ],
      initialValue: "standalone",
    }),
  );
  const monorepo = flags.layout === "monorepo";
  flags.name ??= accepted<string>(
    await clack.text({
      message: "Package/project name",
      placeholder: targetDirectory.split("/").at(-1) ?? "my-project",
      validate: (value) => (PROJECT_NAME_PATTERN.test(value ?? "") ? undefined : PROJECT_NAME_RULE),
    }),
  );

  if (monorepo) {
    flags.apps ??= await askApps();
    flags.packages ??= accepted<string[]>(
      await clack.multiselect<string>({
        message: "Select shared packages",
        options: WORKSPACE_PACKAGES.map((entry) => ({
          value: entry,
          label: entry,
          hint: PACKAGE_HINTS[entry],
        })),
        required: false,
      }),
    );
  } else {
    flags.stack ??= accepted<string>(
      await clack.select<string>({
        message: "Choose a stack",
        options: STACKS.map((stack) => ({
          value: stack,
          label: stack,
          ...(stack === "backend-ts" ? { hint: "Cloudflare Worker API with Turso" } : {}),
        })),
      }),
    );
    const stack = STACKS.find((candidate) => candidate === flags.stack);
    if (stack === undefined) throw new Error(`Unsupported stack: ${flags.stack ?? "missing"}`);
    flags.integrations ??= await askIntegrations(stack);
    if (stack === "marketing" && flags.pages === undefined) flags.pages = await askPages();
  }

  const allowedOperations = operationChoices(flags);
  if (flags.operations === undefined && allowedOperations.length > 0) {
    flags.operations = accepted<string[]>(
      await clack.multiselect<string>({
        message: "Select operations modules",
        options: allowedOperations.map((operation) => ({ value: operation, label: operation })),
        required: false,
      }),
    );
  }
  const themeable = monorepo
    ? (flags.apps ?? []).some(
        (app) => app.stack === "console" || app.stack === "marketing" || app.stack === "expo",
      )
    : flags.stack === "console" || flags.stack === "marketing" || flags.stack === "expo";
  if (flags.theme === undefined && flags.themeFrom === undefined && themeable) {
    flags.theme = accepted<string>(
      await clack.select<string>({
        message: "Choose a theme preset",
        options: THEME_PRESETS.map((preset) => ({
          value: preset,
          label: preset,
          ...(preset === "jade" ? { hint: "house default" } : {}),
        })),
        initialValue: "jade",
      }),
    );
  }
  flags.staging ??= false;
  return flags;
}

export async function confirmInteractiveSummary(summary: string): Promise<void> {
  clack.note(summary, "Review");
  const confirmed = accepted<boolean>(
    await clack.confirm({ message: "Create this project?", initialValue: true }),
  );
  if (!confirmed) throw new PromptCancelledError("Project creation cancelled.");
}

export function showSuccess(target: string): void {
  clack.outro(`Created ${target}`);
}

export function showCancellation(message: string): void {
  clack.cancel(message);
}

export function showPhase(phase: GenerationPhase, command: PlannedCommand): void {
  const labels: Record<GenerationPhase, string> = {
    install: "Installing dependencies",
    generate: "Generating runtime types",
    format: "Formatting authored files",
    git: "Initializing Git",
    hooks: "Installing hooks",
    verify: "Running verification",
  };
  clack.log.step(`${labels[phase]} · ${command.command} ${command.args.join(" ")}`);
}
