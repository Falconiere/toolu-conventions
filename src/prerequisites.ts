import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { ScaffoldManifest } from "./manifest";

export class PrerequisiteError extends Error {
  override name = "PrerequisiteError";

  constructor(readonly missing: readonly string[]) {
    super(
      `Missing prerequisites: ${missing.join(", ")}. Install them and rerun; the initializer does not modify your global toolchain.`,
    );
  }
}

async function commandExists(
  command: string,
  pathValue = process.env.PATH ?? "",
): Promise<boolean> {
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    try {
      await access(join(directory, command), constants.X_OK);
      return true;
    } catch {
      // Continue searching PATH.
    }
  }
  return false;
}

function nodeSupported(version = process.versions.node): boolean {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  return major > 20 || (major === 20 && minor >= 12);
}

interface PrerequisiteEnvironment {
  platform: NodeJS.Platform;
  nodeVersion: string;
  path: string;
}

export async function checkPrerequisites(
  manifest: ScaffoldManifest,
  environment: PrerequisiteEnvironment = {
    platform: process.platform,
    nodeVersion: process.versions.node,
    path: process.env.PATH ?? "",
  },
): Promise<string[]> {
  if (environment.platform === "win32") return ["WSL (native Windows is not supported)"];
  const requirements = [
    ...(!nodeSupported(environment.nodeVersion) ? [{ command: "", label: "Node.js 20.12+" }] : []),
    { command: "bun", label: "bun" },
    { command: "bunx", label: "bunx" },
    { command: "git", label: "git" },
    { command: "jq", label: "jq" },
    { command: "ast-grep", label: "ast-grep" },
    ...(manifest.stack.id === "rust"
      ? [
          { command: "cargo", label: "cargo" },
          { command: "rustfmt", label: "rustfmt" },
          { command: "clippy-driver", label: "clippy" },
        ]
      : []),
  ];
  const availability = await Promise.all(
    requirements.map(async ({ command, label }) =>
      command.length === 0
        ? label
        : (await commandExists(command, environment.path))
          ? undefined
          : label,
    ),
  );
  return availability.filter((value): value is string => value !== undefined);
}

export async function assertPrerequisites(manifest: ScaffoldManifest): Promise<void> {
  const missing = await checkPrerequisites(manifest);
  if (missing.length > 0) throw new PrerequisiteError(missing);
}
