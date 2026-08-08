import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs", () => {
  test("preserves repeatable selections and accepts equals syntax", () => {
    const parsed = parseArgs([
      "my-project",
      "--stack=marketing",
      "--integration",
      "blog",
      "--integration=analytics-posthog",
      "--operation",
      "cloudflare",
      "--page=pricing",
      "--page",
      "about/team",
      "--staging",
      "--port=4321",
    ]);

    expect(parsed).toEqual({
      targetDirectory: "my-project",
      stack: "marketing",
      integrations: ["blog", "analytics-posthog"],
      operations: ["cloudflare"],
      pages: ["pricing", "about/team"],
      staging: true,
      port: 4321,
    });
  });
});
