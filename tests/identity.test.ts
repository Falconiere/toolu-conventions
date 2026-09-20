import { describe, expect, test } from "bun:test";
import {
  bundleIdentifier,
  compactName,
  defaultDomain,
  PROJECT_NAME_PATTERN,
  projectSlug,
  titleCaseProjectName,
  workspacePackageName,
} from "../src/identity";

describe("project identity", () => {
  test("accepts dotted and hyphenated names and rejects malformed ones", () => {
    for (const name of ["agavus.io", "my-app", "acme.co.uk", "a1"]) {
      expect(PROJECT_NAME_PATTERN.test(name)).toBe(true);
    }
    for (const name of ["Agavus.io", ".agavus", "agavus.", "agavus..io", "agavus_io", "my--app"]) {
      expect(PROJECT_NAME_PATTERN.test(name)).toBe(false);
    }
  });

  test("derives dot-free identifiers from a dotted name", () => {
    expect(projectSlug("agavus.io")).toBe("agavus-io");
    expect(compactName("agavus.io")).toBe("agavusio");
    expect(workspacePackageName("agavus.io", "api")).toBe("@agavus-io/api");
    expect(bundleIdentifier("agavus.io")).toBe("io.agavus.app");
    expect(defaultDomain("agavus.io")).toBe("agavus.io");
    expect(titleCaseProjectName("agavus.io")).toBe("Agavus");
  });

  test("keeps the previous derivations for a plain name", () => {
    expect(projectSlug("my-app")).toBe("my-app");
    expect(compactName("my-app")).toBe("myapp");
    expect(workspacePackageName("my-app", "database")).toBe("@my-app/database");
    expect(bundleIdentifier("my-app")).toBe("com.myapp.app");
    expect(defaultDomain("my-app")).toBe("my-app.example.com");
    expect(titleCaseProjectName("my-app")).toBe("My App");
  });

  test("keeps every bundle identifier segment starting with a letter", () => {
    // Android rejects a package segment that starts with a digit.
    expect(bundleIdentifier("2fa.app-tools")).toBe("apptools.a2fa.app");
  });
});
