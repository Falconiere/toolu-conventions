import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";

const repository = resolve(".");
let temporary = "";
let installDirectory = "";
let tarball = "";
let fakeBin = "";

async function executable(name: string, body: string): Promise<void> {
  const path = join(fakeBin, name);
  await writeFile(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  await chmod(path, 0o755);
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), "create-toolu-package-"));
  const build = Bun.spawnSync(["bun", "run", "build:cli"], { cwd: repository });
  expect(build.exitCode, build.stderr.toString()).toBe(0);
  const inspected = Bun.spawnSync(["bash", "scripts/inspect-package.sh"], { cwd: repository });
  expect(inspected.exitCode, inspected.stderr.toString()).toBe(0);

  const packed = Bun.spawnSync(["npm", "pack", "--json", "--pack-destination", temporary], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(packed.exitCode, packed.stderr.toString()).toBe(0);
  const details = JSON.parse(packed.stdout.toString()) as Array<{ filename: string }>;
  tarball = join(temporary, details[0]?.filename ?? "");

  installDirectory = join(temporary, "installed");
  await mkdir(installDirectory);
  await writeFile(join(installDirectory, "package.json"), '{"private":true}\n');
  const installed = Bun.spawnSync(
    ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    { cwd: installDirectory, stdout: "pipe", stderr: "pipe" },
  );
  expect(installed.exitCode, installed.stderr.toString()).toBe(0);

  fakeBin = join(temporary, "bin");
  await mkdir(fakeBin);
  await executable("cargo", "exit 0");
  await executable("bunx", "mkdir -p .git/hooks; : > .git/hooks/pre-commit");
  await executable(
    "git",
    `case "${"$"}{1:-}" in
  init) mkdir -p .git ;;
  rev-parse) [[ -d .git ]] && printf '.git\\n' ;;
  ls-files) exit 1 ;;
  status) exit 0 ;;
esac`,
  );
  await executable("jq", 'exec /usr/bin/jq "$@"');
  await executable("ast-grep", "exit 0");
}, 120_000);

afterAll(async () => {
  if (temporary !== "") await rm(temporary, { recursive: true });
});

describe("published package eval", () => {
  test("installs the npm tarball and exposes its only binary", () => {
    const binary = join(installDirectory, "node_modules/.bin/create-toolu");
    const help = Bun.spawnSync([binary, "--help"], { cwd: installDirectory });

    expect(help.exitCode, help.stderr.toString()).toBe(0);
    expect(help.stdout.toString()).toContain("create-toolu <target>");
  });

  test("scaffolds a complete replay manifest from the installed tarball", async () => {
    const target = join(temporary, "packed-project");
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: target,
        name: "packed-project",
        stack: "rust",
        integrations: ["clap", "serde"],
      },
    });
    const config = join(temporary, "packed-manifest.json");
    await writeFile(config, `${JSON.stringify(manifest, null, 2)}\n`);
    const binary = join(installDirectory, "node_modules/.bin/create-toolu");

    const generated = Bun.spawnSync([binary, "--config", config], {
      cwd: temporary,
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(generated.exitCode, generated.stderr.toString()).toBe(0);
    expect(JSON.parse(await readFile(join(target, "toolu.scaffold.json"), "utf8"))).toEqual(
      manifest,
    );
    expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
  });
});
