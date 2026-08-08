#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args";
import {
  missingRequiredInputs,
  MissingInputsError,
  resolveConfiguration,
  withResolvedTheme,
} from "./configuration";
import type { ResolutionFlags } from "./contracts";
import { generateProject, GenerationFailure, redactDiagnostic } from "./engine";
import { assertGeneratorCompatibility, type ScaffoldManifest } from "./manifest";
import {
  collectInteractiveFlags,
  confirmInteractiveSummary,
  PromptCancelledError,
  showCancellation,
  showPhase,
  showSuccess,
} from "./prompts";
import { renderSummary } from "./summary";
import { resolveImportedTheme } from "./theme";

const HELP = `create-toolu <target> [options]

Create a deterministic Toolu project in a new directory.

Options:
  --config <path>          Replay or extend a toolu.scaffold.json manifest
  --stack <id>             console | marketing | backend-ts | expo | rust
  --name <name>            Lowercase package/project name
  --display-name <name>    Human-readable product name
  --integration <id>       Add an integration (repeatable)
  --operation <id>         Add an operations module (repeatable)
  --staging                Include a staging environment
  --no-staging             Explicitly omit staging
  --theme <preset>         jade | blueprint | ion | chalk
  --theme-from <path>      Import compatible theme tokens with SHA-256 verification
  --page <slug>            Add a marketing route (repeatable)
  --domain <host>          Production domain used by generated metadata
  --console-url <url>      Associated console URL
  --port <number>          Local service port
  -h, --help               Show help
  -v, --version            Show the generator version
`;

async function packageVersion(): Promise<string> {
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const packageFile = JSON.parse(await readFile(packagePath, "utf8")) as { version?: unknown };
  if (typeof packageFile.version !== "string") throw new Error("package version is missing");
  return packageFile.version;
}

async function loadConfiguration(
  path: string | undefined,
): Promise<Partial<ScaffoldManifest> | undefined> {
  if (path === undefined) return undefined;
  const parsed: unknown = JSON.parse(await readFile(resolve(path), "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`configuration must be a JSON object: ${path}`);
  }
  return parsed as Partial<ScaffoldManifest>;
}

function resolutionFlags(parsed: ReturnType<typeof parseArgs>): ResolutionFlags {
  return {
    ...(parsed.targetDirectory !== undefined ? { targetDirectory: parsed.targetDirectory } : {}),
    ...(parsed.stack !== undefined ? { stack: parsed.stack } : {}),
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
    ...(parsed.integrations !== undefined ? { integrations: parsed.integrations } : {}),
    ...(parsed.operations !== undefined ? { operations: parsed.operations } : {}),
    ...(parsed.staging !== undefined ? { staging: parsed.staging } : {}),
    ...(parsed.theme !== undefined ? { theme: parsed.theme } : {}),
    ...(parsed.themeFrom !== undefined ? { themeFrom: parsed.themeFrom } : {}),
    ...(parsed.pages !== undefined ? { pages: parsed.pages } : {}),
    ...(parsed.domain !== undefined ? { domain: parsed.domain } : {}),
    ...(parsed.consoleUrl !== undefined ? { consoleUrl: parsed.consoleUrl } : {}),
    ...(parsed.port !== undefined ? { port: parsed.port } : {}),
  };
}

async function resolveManifest(
  flags: ResolutionFlags,
  config: Partial<ScaffoldManifest> | undefined,
  generatorVersion: string,
): Promise<ScaffoldManifest> {
  if (typeof config?.generatorVersion === "string") {
    assertGeneratorCompatibility(config.generatorVersion, generatorVersion);
  }
  const baseFlags = { ...flags };
  delete baseFlags.themeFrom;
  const manifest = resolveConfiguration({
    generatorVersion,
    flags: baseFlags,
    ...(config === undefined ? {} : { config }),
  });
  if (flags.themeFrom === undefined) return manifest;
  const imported = await resolveImportedTheme(flags.themeFrom, manifest.stack.id);
  return withResolvedTheme(manifest, imported);
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const generatorVersion = await packageVersion();
    if (parsed.help) {
      process.stdout.write(HELP);
      return 0;
    }
    if (parsed.version) {
      process.stdout.write(`${generatorVersion}\n`);
      return 0;
    }

    const config = await loadConfiguration(parsed.config);
    let flags = resolutionFlags(parsed);
    const missing = missingRequiredInputs(flags, config);
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    let prompted = false;
    if (missing.length > 0) {
      if (!interactive) throw new MissingInputsError(missing);
      flags = await collectInteractiveFlags(flags);
      prompted = true;
    }

    const manifest = await resolveManifest(flags, config, generatorVersion);
    if (prompted) await confirmInteractiveSummary(renderSummary(manifest));
    const assetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const result = await generateProject({
      manifest,
      assetRoot,
      ...(interactive ? { onPhase: showPhase } : {}),
    });
    if (interactive) showSuccess(result.targetDirectory);
    else process.stdout.write(`Created ${result.targetDirectory}\n`);
    return 0;
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      showCancellation(error.message);
      return 130;
    }
    const message = redactDiagnostic(error instanceof Error ? error.message : String(error));
    process.stderr.write(`${message}\n`);
    if (error instanceof GenerationFailure) {
      process.stderr.write(`Failed output retained at ${error.stagingDirectory}\n`);
    }
    return 1;
  }
}

process.exitCode = await main();
