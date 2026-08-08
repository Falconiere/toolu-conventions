import { createHash } from "node:crypto";
import { realpath, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { StackId } from "./contracts";
import type { ScaffoldManifest } from "./manifest";

const WEB_THEME_FILES = ["palette.css", "scale.css"] as const;
const NATIVE_THEME_FILES = [
  "colors.ts",
  "icons.ts",
  "motion.ts",
  "spacing.ts",
  "typography.ts",
] as const;

export class ThemeImportError extends Error {
  override name = "ThemeImportError";
}

function expectedTheme(stack: StackId) {
  if (stack === "console" || stack === "marketing") {
    return { target: "web" as const, files: WEB_THEME_FILES };
  }
  if (stack === "expo") return { target: "native" as const, files: NATIVE_THEME_FILES };
  throw new ThemeImportError(`${stack} does not support theme imports`);
}

async function locateThemeDirectory(source: string, files: readonly string[]): Promise<string> {
  const candidates = [resolve(source), resolve(source, "src/ui/theme")];
  for (const candidate of candidates) {
    try {
      const details = await stat(candidate);
      if (!details.isDirectory()) continue;
      await Promise.all(files.map((file) => stat(join(candidate, file))));
      return realpath(candidate);
    } catch {
      // Try the next supported project layout.
    }
  }
  throw new ThemeImportError(`theme source is missing required files: ${files.join(", ")}`);
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function resolveThemeFile(source: string, path: string): Promise<string> {
  if (isAbsolute(path)) throw new ThemeImportError(`theme file path escapes its source: ${path}`);
  const sourceRoot = await realpath(source);
  const candidate = resolve(sourceRoot, path);
  const lexicalRelative = relative(sourceRoot, candidate);
  if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`)) {
    throw new ThemeImportError(`theme file path escapes its source: ${path}`);
  }
  const file = await realpath(candidate);
  const physicalRelative = relative(sourceRoot, file);
  if (physicalRelative === ".." || physicalRelative.startsWith(`..${sep}`)) {
    throw new ThemeImportError(`theme file path escapes its source: ${path}`);
  }
  return file;
}

export async function resolveImportedTheme(
  source: string,
  stack: StackId,
): Promise<Extract<ScaffoldManifest["theme"], { kind: "import" }>> {
  const expected = expectedTheme(stack);
  const directory = await locateThemeDirectory(source, expected.files);
  const files = await Promise.all(
    expected.files.map(async (path) => ({
      path,
      target: expected.target,
      sha256: await sha256(await resolveThemeFile(directory, path)),
    })),
  );
  return { kind: "import", source: directory, files };
}

export async function verifyImportedTheme(
  theme: Extract<ScaffoldManifest["theme"], { kind: "import" }>,
): Promise<void> {
  for (const file of theme.files) {
    await readVerifiedImportedThemeFile(theme, file);
  }
}

export async function readVerifiedImportedThemeFile(
  theme: Extract<ScaffoldManifest["theme"], { kind: "import" }>,
  file: Extract<ScaffoldManifest["theme"], { kind: "import" }>["files"][number],
): Promise<string> {
  const path = await resolveThemeFile(theme.source, file.path);
  const content = await readFile(path);
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== file.sha256) {
    throw new ThemeImportError(
      `theme file hash mismatch for ${file.path}: expected ${file.sha256}, received ${actual}`,
    );
  }
  return content.toString("utf8");
}
