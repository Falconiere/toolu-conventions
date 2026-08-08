import { describe, expect, test } from "bun:test";

describe("npm release contract", () => {
  test("publishes through Semantic Release with trusted-publisher provenance", async () => {
    const release = JSON.parse(await Bun.file(".releaserc.json").text()) as {
      plugins: unknown[];
    };
    const workflow = await Bun.file(".github/workflows/release.yml").text();
    const setup = await Bun.file("SETUP.md").text();

    expect(release.plugins).toContain("@semantic-release/npm");
    expect(JSON.stringify(release.plugins)).not.toContain('"npmPublish":false');
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm@11.5.1");
    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(setup).toContain("npm trusted publisher");
    expect(setup).toContain("@toolu/create");
  });
});
