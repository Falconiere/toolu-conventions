import { describe, expect, test } from "bun:test";
import { InvalidArgumentsError, parseArgs } from "../src/args";

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

  test("rejects ports outside the TCP range at the argument boundary", () => {
    expect(() => parseArgs(["project", "--port", "0"])).toThrow(InvalidArgumentsError);
    expect(() => parseArgs(["project", "--port", "65536"])).toThrow(InvalidArgumentsError);
  });

  test("reports unknown options and missing values", () => {
    expect(() => parseArgs(["project", "--wat"])).toThrow("unknown option: --wat");
    expect(() => parseArgs(["project", "--name", "--stack", "console"])).toThrow(
      "--name requires a value",
    );
  });

  test("accepts an option-looking display name through equals syntax", () => {
    expect(parseArgs(["project", "--display-name=-- Internal"])).toEqual({
      targetDirectory: "project",
      displayName: "-- Internal",
    });
  });
});
