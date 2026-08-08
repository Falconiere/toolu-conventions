import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSafeTarget, TargetPathError } from "../src/path-safety";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("resolveSafeTarget", () => {
  test("rejects an existing target before generation", async () => {
    const parent = await mkdtemp(join(tmpdir(), "toolu-path-test-"));
    temporaryDirectories.push(parent);

    expect(() => resolveSafeTarget(".", parent)).toThrow(TargetPathError);
    expect(() => resolveSafeTarget(".", parent)).toThrow("target directory already exists");
  });
});
