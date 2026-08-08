import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import { resolveImportedTheme } from "../../src/theme";

const repository = resolve(".");
const binary = resolve("dist/create-toolu.js");
let temporary = "";
let fakeBin = "";

async function executable(name: string, content: string): Promise<void> {
  const path = join(fakeBin, name);
  await writeFile(path, `#!/usr/bin/env bash\nset -euo pipefail\n${content}\n`);
  await chmod(path, 0o755);
}

function invoke(args: string[], extraEnvironment: Record<string, string> = {}) {
  return Bun.spawnSync(["node", binary, ...args], {
    cwd: temporary,
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}`, ...extraEnvironment },
    stdout: "pipe",
    stderr: "pipe",
  });
}

beforeAll(async () => {
  const build = Bun.spawnSync(["bun", "run", "build:cli"], { cwd: repository });
  expect(build.exitCode, build.stderr.toString()).toBe(0);
  temporary = await mkdtemp(join(tmpdir(), "create-toolu-integration-"));
  fakeBin = join(temporary, "bin");
  await mkdir(fakeBin);
  await executable("cargo", 'printf "cargo %s\\n" "$*" >> .integration-commands');
  await executable(
    "git",
    `case "${"$"}{1:-}" in
  init) mkdir -p .git ;;
  rev-parse) [[ -d .git ]] && printf '.git\\n' ;;
  ls-files) exit 1 ;;
  status) exit 0 ;;
esac`,
  );
  await executable("bunx", "mkdir -p .git/hooks; : > .git/hooks/pre-commit");
  await executable("bun", 'printf "bun %s\\n" "$*" >> .integration-commands');
  await executable("jq", 'exec /usr/bin/jq "$@"');
  await executable("ast-grep", "exit 0");
});

afterAll(async () => {
  if (temporary !== "") await rm(temporary, { recursive: true });
});

describe("built create-toolu CLI", () => {
  test("exposes the packaged command help", () => {
    const result = invoke(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("create-toolu <target>");
    expect(result.stdout.toString()).toContain("--integration <id>");
  });

  test("lists every missing required flag in non-TTY mode", () => {
    const result = invoke([]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString().trim()).toBe(
      "Missing required options: <target>, --stack, --name",
    );
  });

  test("scaffolds through the built binary, initializes git, and installs hooks", async () => {
    const result = invoke(["acme-cli", "--stack", "rust", "--name", "acme-cli"]);
    const target = join(temporary, "acme-cli");

    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(await readFile(join(target, "toolu.scaffold.json"), "utf8"))).toMatchObject({
      schemaVersion: 1,
      project: { name: "acme-cli" },
      stack: { id: "rust" },
    });
    expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
    expect(await readFile(join(target, ".integration-commands"), "utf8")).toContain(
      "cargo clippy --all-targets --all-features -- -D warnings",
    );
  });

  test("replays a complete manifest through the built binary", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "replayed-cli",
        name: "replayed-cli",
        stack: "rust",
        integrations: ["clap"],
      },
    });
    const config = join(temporary, "replay.json");
    await writeFile(config, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = invoke(["--config", config]);

    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(
      JSON.parse(await readFile(join(temporary, "replayed-cli", "toolu.scaffold.json"), "utf8")),
    ).toEqual(manifest);
  });

  test("rejects unknown fields in replay configuration before generation", async () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "invalid-replay", name: "invalid-replay", stack: "rust" },
    });
    const config = join(temporary, "invalid-replay.json");
    await writeFile(config, `${JSON.stringify({ ...manifest, unexpected: true }, null, 2)}\n`);

    const result = invoke(["--config", config]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Unrecognized key");
    expect(await Bun.file(join(temporary, "invalid-replay")).exists()).toBe(false);
  });

  test("rejects a replay when an imported theme hash has changed", async () => {
    const themeDirectory = join(temporary, "replay-theme");
    await mkdir(themeDirectory);
    for (const path of ["palette.css", "scale.css"]) {
      await writeFile(
        join(themeDirectory, path),
        await Bun.file(resolve("stacks/console/templates/theme", path)).text(),
      );
    }
    const base = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "theme-replay", name: "theme-replay", stack: "console" },
    });
    const theme = await resolveImportedTheme(themeDirectory, "console");
    const config = join(temporary, "theme-replay.json");
    await writeFile(config, `${JSON.stringify({ ...base, theme }, null, 2)}\n`);
    await writeFile(join(themeDirectory, "palette.css"), ":root { --changed: true; }\n");

    const result = invoke(["--config", config]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("theme file hash mismatch for palette.css");
    expect(await Bun.file(join(temporary, "theme-replay")).exists()).toBe(false);
  });

  test("scaffolds a hash-recorded web theme import through the built binary", async () => {
    const result = invoke([
      "theme-import",
      "--stack",
      "console",
      "--name",
      "theme-import",
      "--theme-from",
      resolve("stacks/console/templates/theme"),
    ]);

    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const manifest = JSON.parse(
      await readFile(join(temporary, "theme-import", "toolu.scaffold.json"), "utf8"),
    );
    expect(manifest.theme).toMatchObject({ kind: "import" });
    expect(manifest.recipes).toContain("theme/import/web");
    expect(manifest.recipes).not.toContain("theme/preset/jade");
  });

  test("retains failed staging output instead of exposing a partial target", async () => {
    await executable(
      "cargo",
      'if [[ "$*" == *clippy* ]]; then echo "API_TOKEN=do-not-leak" >&2; exit 9; fi',
    );
    const result = invoke(["broken-cli", "--stack", "rust", "--name", "broken-cli"]);
    const target = join(temporary, "broken-cli");
    const staging = join(temporary, ".broken-cli.toolu-staging");

    expect(result.exitCode).toBe(1);
    expect(await Bun.file(target).exists()).toBe(false);
    expect(await Bun.file(join(staging, ".toolu-failure.json")).exists()).toBe(true);
    expect(result.stderr.toString()).toContain("verify failed");
    expect(result.stderr.toString()).not.toContain("do-not-leak");
  });
});
