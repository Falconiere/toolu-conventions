import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import { generateProject, runCommand } from "../../src/engine";

test.each([false, true])(
  "real Rust toolchain eval serves the configured port (clap: %s)",
  async (clap) => {
    const temporary = await mkdtemp(join(tmpdir(), "toolu-rust-e2e-"));
    const target = join(temporary, "verified-service");
    const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    const port = reservation.port!;
    await reservation.stop(true);
    const manifest = resolveConfiguration({
      generatorVersion: "0.7.0",
      flags: {
        targetDirectory: target,
        name: "verified-service",
        stack: "rust",
        integrations: clap ? ["clap", "axum", "serde"] : ["axum", "serde"],
        operations: ["infisical", "local-dev"],
        port,
      },
    });

    try {
      const result = await generateProject({ manifest, assetRoot: resolve(".") });

      expect(result.targetDirectory).toBe(await realpath(target));
      expect(await Bun.file(join(target, "Cargo.lock")).exists()).toBe(true);
      expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
      expect(await Bun.file(join(target, "operations.config.json")).exists()).toBe(true);
      expect(await readFile(join(target, "src/http/router.rs"), "utf8")).toContain("/health");
      const build = await runCommand(
        { phase: "verify", command: "cargo", args: ["build"] },
        target,
      );
      expect(build.exitCode, build.stderr).toBe(0);
      const service = Bun.spawn([join(target, "target/debug/verified-service")], {
        cwd: target,
        stdout: "ignore",
        stderr: "pipe",
      });
      try {
        let response: Response | undefined;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (service.exitCode !== null) break;
          try {
            response = await fetch(`http://127.0.0.1:${port}/health`, {
              signal: AbortSignal.timeout(500),
            });
            break;
          } catch {
            await Bun.sleep(50);
          }
        }
        expect(response?.status).toBe(200);
        expect(await response?.json()).toEqual({ status: "ok" });
      } finally {
        service.kill();
        await service.exited;
      }
    } finally {
      await rm(temporary, { recursive: true });
    }
  },
  180_000,
);
