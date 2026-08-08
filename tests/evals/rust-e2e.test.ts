import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import { generateProject } from "../../src/engine";

test("real Rust toolchain eval installs, initializes hooks, and passes canonical checks", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "toolu-rust-e2e-"));
  const target = join(temporary, "verified-service");
  const manifest = resolveConfiguration({
    generatorVersion: "0.6.0",
    flags: {
      targetDirectory: target,
      name: "verified-service",
      stack: "rust",
      integrations: ["clap", "axum", "serde"],
      operations: ["infisical", "local-dev"],
    },
  });

  try {
    const result = await generateProject({ manifest, assetRoot: resolve(".") });

    expect(result.targetDirectory).toBe(target);
    expect(await Bun.file(join(target, "Cargo.lock")).exists()).toBe(true);
    expect(await Bun.file(join(target, ".git/hooks/pre-commit")).exists()).toBe(true);
    expect(await Bun.file(join(target, "operations.config.json")).exists()).toBe(true);
    expect(await readFile(join(target, "src/http/router.rs"), "utf8")).toContain("/health");
  } finally {
    await rm(temporary, { recursive: true });
  }
}, 120_000);
