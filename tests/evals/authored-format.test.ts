import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { resolveConfiguration } from "../../src/configuration";
import type { ResolutionFlags } from "../../src/contracts";
import { planRecipe, type PlannedFile } from "../../src/recipes";

/**
 * The generator runs `bun run fmt` before it runs the gate, so a mis-quoted
 * authored file is silently rewritten and the eval suite stays green. That
 * hides drift between what the recipes emit and what the generated project's
 * own formatter demands — which is what a reader of the templates actually
 * sees. This holds the authored bytes to the formatter's output directly.
 */
const cases: Array<{ id: string; flags: ResolutionFlags }> = [
  {
    id: "console",
    flags: { stack: "console", integrations: ["api", "auth", "worker-api"], theme: "blueprint" },
  },
  {
    id: "marketing",
    flags: {
      stack: "marketing",
      integrations: ["blog", "changelog", "ssr-cloudflare", "react-island", "analytics-posthog"],
      pages: ["home", "pricing"],
    },
  },
  {
    id: "backend",
    flags: {
      stack: "backend-ts",
      integrations: ["auth", "structured-logging", "drizzle", "database-package"],
    },
  },
  { id: "expo", flags: { stack: "expo", integrations: ["api", "auth", "async-storage"] } },
  {
    id: "monorepo",
    flags: {
      layout: "monorepo",
      apps: [
        { id: "console", stack: "console", integrations: ["api"] },
        { id: "api", stack: "backend-ts", integrations: ["drizzle", "database-package"] },
        { id: "marketing", stack: "marketing", integrations: [], pages: ["home"] },
      ],
      packages: ["database", "ui", "types", "config"],
    },
  },
];

const FORMATTABLE = /\.(ts|tsx|mjs|js)$/;

function formattable(file: PlannedFile): boolean {
  return FORMATTABLE.test(file.path) && !file.path.startsWith("scripts/");
}

async function writeTree(root: string, files: readonly PlannedFile[]): Promise<void> {
  for (const file of files) {
    const destination = join(root, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.content);
  }
}

for (const scenario of cases) {
  test(`authored ${scenario.id} sources already satisfy the project's own formatter`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), `toolu-fmt-${scenario.id}-`));
    try {
      const manifest = resolveConfiguration({
        generatorVersion: "0.8.1",
        flags: { ...scenario.flags, targetDirectory: join(temporary, "tree"), name: "fmt-eval" },
      });
      const files = (await planRecipe(manifest, resolve("."))).filter(formattable);
      const root = join(temporary, "tree");
      await writeTree(root, files);

      const formatted = Bun.spawnSync(["bunx", "oxfmt", "."], { cwd: root });
      expect(formatted.exitCode, formatted.stderr.toString()).toBe(0);

      const drifted: string[] = [];
      for (const file of files) {
        const onDisk = await readFile(join(root, file.path), "utf8");
        if (onDisk !== file.content) drifted.push(file.path);
      }
      expect(drifted).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true });
    }
  }, 120_000);
}
