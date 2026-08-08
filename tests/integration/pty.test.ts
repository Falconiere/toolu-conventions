import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(".");
const binary = resolve("dist/create-toolu.js");
const driver = resolve("tests/integration/pty-driver.py");
let temporary = "";
let fakeBin = "";

async function executable(name: string, body: string): Promise<void> {
  const path = join(fakeBin, name);
  await writeFile(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  await chmod(path, 0o755);
}

function run(mode: "happy" | "validation" | "cancel") {
  return Bun.spawnSync(["python3", driver, mode, binary, temporary], {
    cwd: repository,
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
    stdout: "pipe",
    stderr: "pipe",
  });
}

beforeAll(async () => {
  const build = Bun.spawnSync(["bun", "run", "build:cli"], { cwd: repository });
  expect(build.exitCode, build.stderr.toString()).toBe(0);
  temporary = await mkdtemp(join(tmpdir(), "create-toolu-pty-"));
  fakeBin = join(temporary, "bin");
  await mkdir(fakeBin);
  await executable("bun", "exit 0");
  await executable("bunx", "mkdir -p .git/hooks; : > .git/hooks/pre-commit");
  await executable("git", '[[ "${1:-}" == init ]] && mkdir -p .git; exit 0');
  await executable("jq", 'exec /usr/bin/jq "$@"');
  await executable("ast-grep", "exit 0");
});

afterAll(async () => {
  if (temporary !== "") await rm(temporary, { recursive: true });
});

describe("Clack wizard PTY eval", () => {
  test("handles select, multiselect, conditional questions, review, and progress", async () => {
    const result = run("happy");
    const output = result.stdout.toString();

    expect(result.exitCode, `${output}\n${result.stderr.toString()}`).toBe(0);
    expect(output).toContain("Routes (comma separated)");
    expect(output).toContain("Review");
    expect(output).toContain("Installing dependencies");
    expect(output).toContain("Created");
    expect(await Bun.file(join(temporary, "pty-eval", "toolu.scaffold.json")).exists()).toBe(true);
  }, 60_000);

  test("renders validation feedback inside the live prompt", () => {
    const result = run("validation");

    expect(result.exitCode).toBe(130);
    expect(result.stdout.toString()).toContain(
      "Use lowercase letters, numbers, and single hyphens.",
    );
  }, 30_000);

  test("maps Ctrl+C to a graceful cancellation exit", () => {
    const result = run("cancel");

    expect(result.exitCode).toBe(130);
    expect(result.stdout.toString()).toContain("Project creation cancelled.");
  }, 30_000);
});
