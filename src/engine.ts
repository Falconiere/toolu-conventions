import { spawn } from "node:child_process";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import type { ScaffoldManifest } from "./manifest";
import { resolveSafeTarget } from "./path-safety";
import { assertPrerequisites } from "./prerequisites";
import { planRecipe } from "./recipes";

export type GenerationPhase = "install" | "generate" | "format" | "git" | "hooks" | "verify";

export interface PlannedCommand {
  phase: GenerationPhase;
  command: string;
  args: string[];
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: PlannedCommand,
  workingDirectory: string,
) => Promise<CommandResult>;

export interface GenerateProjectOptions {
  manifest: ScaffoldManifest;
  assetRoot: string;
  runner?: CommandRunner;
  onPhase?: (phase: GenerationPhase, command: PlannedCommand) => void;
}

export interface GenerationResult {
  targetDirectory: string;
  manifest: ScaffoldManifest;
  commands: PlannedCommand[];
}

export class GenerationFailure extends Error {
  override name = "GenerationFailure";

  constructor(
    message: string,
    readonly stagingDirectory: string,
    readonly phase?: GenerationPhase,
    readonly exitCode?: number,
  ) {
    super(message);
  }
}

function operationCommands(manifest: ScaffoldManifest): PlannedCommand[] {
  if (manifest.operations.length === 0) return [];
  return [
    {
      phase: "verify",
      command: "bash",
      args: ["scripts/operations/validate-config.sh", "operations.config.json"],
    },
    ...(manifest.operations.includes("local-dev")
      ? [
          {
            phase: "verify" as const,
            command: "bash",
            args: ["scripts/operations/dev/preflight.sh", "--check-config"],
          },
        ]
      : []),
  ];
}

export function planCommands(manifest: ScaffoldManifest): PlannedCommand[] {
  if (manifest.stack.id === "rust") {
    return [
      { phase: "install", command: "cargo", args: ["fetch"] },
      { phase: "git", command: "git", args: ["init", "--initial-branch=main"] },
      { phase: "hooks", command: "bunx", args: ["lefthook@2.1.10", "install", "--force"] },
      { phase: "verify", command: "cargo", args: ["fmt", "--check"] },
      {
        phase: "verify",
        command: "cargo",
        args: ["clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
      },
      { phase: "verify", command: "bash", args: ["scripts/guardrails/run.sh"] },
      { phase: "verify", command: "cargo", args: ["test", "--all-features"] },
      ...operationCommands(manifest),
    ];
  }
  return [
    {
      phase: "install",
      command: "bun",
      args: ["install", "--network-concurrency=8"],
    },
    ...(manifest.stack.id === "backend-ts"
      ? [
          manifest.stack.workspace
            ? {
                phase: "generate" as const,
                command: "bun",
                args: ["run", "--filter", `@${manifest.project.name}/api`, "cf-typegen"],
              }
            : { phase: "generate" as const, command: "bun", args: ["run", "cf-typegen"] },
        ]
      : []),
    { phase: "format", command: "bun", args: ["run", "fmt"] },
    { phase: "git", command: "git", args: ["init", "--initial-branch=main"] },
    { phase: "hooks", command: "bunx", args: ["lefthook@2.1.10", "install", "--force"] },
    { phase: "verify", command: "bun", args: ["run", "check"] },
    ...(manifest.stack.id !== "backend-ts" || !manifest.stack.workspace
      ? [{ phase: "verify" as const, command: "bun", args: ["run", "build"] }]
      : []),
    ...operationCommands(manifest),
  ];
}

export function redactDiagnostic(value: string): string {
  return value
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(
      /((?:token|secret|password|api[_-]?key|auth[_-]?token)\s*[=:]\s*)[^\s]+/gi,
      "$1[REDACTED]",
    );
}

export function createCommandRunner(
  timeoutMs = 900_000,
  terminationGraceMs = 5_000,
): CommandRunner {
  return async (planned, workingDirectory) =>
    new Promise((resolveResult, reject) => {
      // Bun's installer can deadlock while resolving large graphs when it is made
      // the leader of a detached process group. Keep installs attached and signal
      // that child directly; isolate other commands so their descendants can be
      // terminated together on timeout.
      const isolateProcessGroup =
        process.platform !== "win32" &&
        !(planned.command === "bun" && planned.args[0] === "install");
      const commandTimeoutMs =
        planned.command === "bun" && planned.args[0] === "install"
          ? Math.min(timeoutMs, 120_000)
          : timeoutMs;
      const child = spawn(planned.command, planned.args, {
        cwd: workingDirectory,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: isolateProcessGroup,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let forceTimer: NodeJS.Timeout | undefined;
      const signalChildGroup = (signal: NodeJS.Signals): void => {
        try {
          if (isolateProcessGroup && child.pid !== undefined) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          child.kill(signal);
        }
      };
      const timeout = setTimeout(() => {
        timedOut = true;
        stderr += `${stderr.endsWith("\n") || stderr.length === 0 ? "" : "\n"}command timed out after ${commandTimeoutMs}ms\n`;
        signalChildGroup("SIGTERM");
        forceTimer = setTimeout(() => signalChildGroup("SIGKILL"), terminationGraceMs);
        forceTimer.unref();
      }, commandTimeoutMs);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        if (forceTimer !== undefined) clearTimeout(forceTimer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (forceTimer !== undefined) clearTimeout(forceTimer);
        resolveResult({ exitCode: timedOut ? 124 : (code ?? 1), stdout, stderr });
      });
    });
}

export const runCommand: CommandRunner = createCommandRunner();

function outputPath(staging: string, relativePath: string): string {
  if (relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error(`unsafe authored path: ${relativePath}`);
  }
  const normalized = normalize(relativePath);
  if (normalized === ".." || normalized.startsWith(`..${sep}`)) {
    throw new Error(`unsafe authored path: ${relativePath}`);
  }
  const destination = resolve(staging, normalized);
  if (!destination.startsWith(`${staging}${sep}`)) {
    throw new Error(`unsafe authored path: ${relativePath}`);
  }
  return destination;
}

interface CommandLog {
  phase: GenerationPhase;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

function safeLogOutput(value: string): string {
  const maximum = 32_768;
  const redacted = redactDiagnostic(value);
  return redacted.length > maximum ? `${redacted.slice(0, maximum)}\n[TRUNCATED]` : redacted;
}

async function retainFailure(
  staging: string,
  failure: { phase?: GenerationPhase; exitCode?: number; message: string },
  commands: CommandLog[],
): Promise<void> {
  await writeFile(
    join(staging, ".toolu-failure.json"),
    `${JSON.stringify(
      {
        phase: failure.phase ?? "author",
        exitCode: failure.exitCode ?? null,
        message: redactDiagnostic(failure.message),
        commands,
        guidance: `Inspect this directory, then remove or rename it before rerunning the initializer.`,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
}

export async function generateProject(options: GenerateProjectOptions): Promise<GenerationResult> {
  await assertPrerequisites(options.manifest);
  const safeTarget = resolveSafeTarget(options.manifest.project.targetDirectory);
  const staging = join(safeTarget.parent, `.${safeTarget.name}.toolu-staging`);
  const stagingCheck = resolveSafeTarget(staging);
  if (stagingCheck.parent !== safeTarget.parent) {
    throw new GenerationFailure("staging directory escaped the target parent", staging);
  }

  const plannedFiles = await planRecipe(options.manifest, options.assetRoot);
  const commands = planCommands(options.manifest);
  const runner = options.runner ?? runCommand;
  const commandLogs: CommandLog[] = [];

  await mkdir(staging, { mode: 0o700 });
  try {
    for (const file of plannedFiles) {
      const destination = outputPath(staging, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.content, { mode: file.mode ?? 0o644 });
      if (file.mode !== undefined) await chmod(destination, file.mode);
    }

    for (const command of commands) {
      const maximumAttempts = command.command === "bun" && command.args[0] === "install" ? 3 : 1;
      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        options.onPhase?.(command.phase, command);
        const result = await runner(command, staging);
        const log: CommandLog = {
          ...command,
          exitCode: result.exitCode,
          stdout: safeLogOutput(result.stdout),
          stderr: safeLogOutput(result.stderr),
        };
        commandLogs.push(log);
        if (result.exitCode === 0) break;
        if (result.exitCode === 124 && attempt < maximumAttempts) continue;

        const detail = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
        throw new GenerationFailure(
          `${command.phase} failed (${command.command} ${command.args.join(" ")}): ${redactDiagnostic(detail || "command failed without output")}`,
          staging,
          command.phase,
          result.exitCode,
        );
      }
    }
    await rename(staging, safeTarget.target);
    return { targetDirectory: safeTarget.target, manifest: options.manifest, commands };
  } catch (error) {
    const failure =
      error instanceof GenerationFailure
        ? error
        : new GenerationFailure(error instanceof Error ? error.message : String(error), staging);
    await retainFailure(
      staging,
      {
        message: failure.message,
        ...(failure.phase === undefined ? {} : { phase: failure.phase }),
        ...(failure.exitCode === undefined ? {} : { exitCode: failure.exitCode }),
      },
      commandLogs,
    );
    throw failure;
  }
}
