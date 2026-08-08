import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { resolveConfiguration } from "../src/configuration";
import {
  GenerationFailure,
  createCommandRunner,
  generateProject,
  planCommands,
  redactDiagnostic,
  type CommandRunner,
} from "../src/engine";

describe("generator engine", () => {
  test("plans install, git, hooks, checks, and build in canonical order", () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-console", name: "acme-console", stack: "console" },
    });

    expect(
      planCommands(manifest).map(({ phase, command, args }) => [phase, command, ...args]),
    ).toEqual([
      ["install", "bun", "install", "--network-concurrency=8"],
      ["format", "bun", "run", "fmt"],
      ["git", "git", "init", "--initial-branch=main"],
      ["hooks", "bunx", "lefthook@2.1.10", "install", "--force"],
      ["verify", "bun", "run", "check"],
      ["verify", "bun", "run", "build"],
    ]);
  });

  test("includes Rust structure guardrails in the canonical verification plan", () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-cli", name: "acme-cli", stack: "rust" },
    });

    expect(planCommands(manifest)).toContainEqual({
      phase: "verify",
      command: "bash",
      args: ["scripts/guardrails/run.sh"],
    });
  });

  test("generates Cloudflare binding types before checking a backend", () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: "acme-api", name: "acme-api", stack: "backend-ts" },
    });

    expect(planCommands(manifest).slice(0, 3)).toEqual([
      { phase: "install", command: "bun", args: ["install", "--network-concurrency=8"] },
      { phase: "generate", command: "bun", args: ["run", "cf-typegen"] },
      { phase: "format", command: "bun", args: ["run", "fmt"] },
    ]);
  });

  test("verifies selected operations manifests and local-dev preflight", () => {
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: {
        targetDirectory: "acme-api",
        name: "acme-api",
        stack: "backend-ts",
        operations: ["local-dev"],
      },
    });

    expect(planCommands(manifest).slice(-2)).toEqual([
      {
        phase: "verify",
        command: "bash",
        args: ["scripts/operations/validate-config.sh", "operations.config.json"],
      },
      {
        phase: "verify",
        command: "bash",
        args: ["scripts/operations/dev/preflight.sh", "--check-config"],
      },
    ]);
  });

  test("authors in a sibling directory and atomically promotes only after verification", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "toolu-engine-"));
    const target = join(temporary, "acme-cli");
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: target, name: "acme-cli", stack: "rust" },
    });
    const phases: string[] = [];
    const runner: CommandRunner = async (command) => {
      phases.push(command.phase);
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    try {
      const result = await generateProject({ manifest, assetRoot: resolve("."), runner });

      await access(join(target, "Cargo.toml"));
      await access(join(target, "toolu.scaffold.json"));
      expect(result.targetDirectory).toBe(target);
      expect(phases).toEqual(["install", "git", "hooks", "verify", "verify", "verify", "verify"]);
      expect((await readdir(temporary)).filter((path) => path.includes("staging"))).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true });
    }
  });

  test("retries a timed-out Bun install before continuing generation", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "toolu-engine-retry-"));
    const target = join(temporary, "acme-console");
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: target, name: "acme-console", stack: "console" },
    });
    let installAttempts = 0;
    const runner: CommandRunner = async (command) => {
      if (command.phase === "install" && installAttempts++ === 0) {
        return { exitCode: 124, stdout: "", stderr: "command timed out" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    try {
      await generateProject({ manifest, assetRoot: resolve("."), runner });
      expect(installAttempts).toBe(2);
      await access(join(target, "toolu.scaffold.json"));
    } finally {
      await rm(temporary, { recursive: true });
    }
  });

  test("retains failed staging output and a redacted command log", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "toolu-engine-failure-"));
    const target = join(temporary, "acme-api");
    const manifest = resolveConfiguration({
      generatorVersion: "0.6.0",
      flags: { targetDirectory: target, name: "acme-api", stack: "backend-ts" },
    });
    const runner: CommandRunner = async (command) => ({
      exitCode: command.phase === "verify" ? 7 : 0,
      stdout: "",
      stderr: command.phase === "verify" ? "token=super-secret-value" : "",
    });

    try {
      await expect(
        generateProject({ manifest, assetRoot: resolve("."), runner }),
      ).rejects.toBeInstanceOf(GenerationFailure);
      const entries = await readdir(temporary);
      const stagingName = entries.find((entry) => entry.includes("staging"));
      expect(stagingName).toBeDefined();
      const diagnostic = await readFile(
        join(temporary, stagingName ?? "", ".toolu-failure.json"),
        "utf8",
      );
      expect(diagnostic).toContain('"phase": "verify"');
      expect(diagnostic).toContain("[REDACTED]");
      expect(diagnostic).not.toContain("super-secret-value");
      expect(dirname(join(temporary, stagingName ?? ""))).toBe(dirname(target));
      expect(basename(stagingName ?? "")).toContain("acme-api");
    } finally {
      await rm(temporary, { recursive: true });
    }
  });

  test("redacts common credentials without obscuring ordinary diagnostics", () => {
    expect(
      redactDiagnostic(
        "Authorization: Bearer abc.def\nTURSO_AUTH_TOKEN=secret\nport already in use",
      ),
    ).toBe("Authorization: Bearer [REDACTED]\nTURSO_AUTH_TOKEN=[REDACTED]\nport already in use");
  });

  test("bounds an unresponsive child command with an actionable timeout result", async () => {
    const runner = createCommandRunner(25, 25);

    const result = await runner(
      {
        phase: "verify",
        command: process.execPath,
        args: ["-e", "setInterval(() => {}, 1_000)"],
      },
      resolve("."),
    );

    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("command timed out after 25ms");
  });
});
