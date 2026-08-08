import * as clack from "@clack/prompts";
import { INTEGRATIONS, OPERATIONS, STACKS, THEME_PRESETS, type ResolutionFlags } from "./contracts";
import type { GenerationPhase, PlannedCommand } from "./engine";

export class PromptCancelledError extends Error {
  override name = "PromptCancelledError";
}

function accepted<T extends boolean | string | string[]>(value: T | symbol): T {
  if (typeof value === "symbol") throw new PromptCancelledError("Project creation cancelled.");
  return value;
}

function operationChoices(flags: ResolutionFlags): readonly string[] {
  if (flags.stack === "marketing") return ["cloudflare", "local-dev"];
  if (flags.stack === "expo") return ["local-dev"];
  if (flags.stack === "rust") {
    return flags.integrations?.includes("axum") ? ["infisical", "local-dev"] : [];
  }
  if (flags.stack === "console" && !flags.integrations?.includes("worker-api")) {
    return ["cloudflare", "local-dev"];
  }
  return OPERATIONS;
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
  flags.name ??= accepted<string>(
    await clack.text({
      message: "Package/project name",
      placeholder: targetDirectory.split("/").at(-1) ?? "my-project",
      validate: (value) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")
          ? undefined
          : "Use lowercase letters, numbers, and single hyphens.",
    }),
  );
  if (flags.integrations === undefined) {
    const stack = STACKS.find((candidate) => candidate === flags.stack);
    if (stack === undefined) throw new Error(`Unsupported stack: ${flags.stack ?? "missing"}`);
    flags.integrations = accepted<string[]>(
      await clack.multiselect<string>({
        message: "Select integrations",
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
  if (flags.stack === "marketing" && flags.pages === undefined) {
    const pageInput = accepted<string>(
      await clack.text({
        message: "Routes (comma separated)",
        placeholder: "home, pricing, about/team",
        defaultValue: "home",
      }),
    );
    flags.pages = pageInput
      .split(",")
      .map((page) => page.trim())
      .filter(Boolean);
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
  if (
    flags.theme === undefined &&
    flags.themeFrom === undefined &&
    (flags.stack === "console" || flags.stack === "marketing" || flags.stack === "expo")
  ) {
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
