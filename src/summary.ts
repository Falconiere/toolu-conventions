import type { ScaffoldManifest } from "./manifest";

function themeLabel(manifest: ScaffoldManifest): string {
  if (manifest.theme.kind === "preset") return manifest.theme.preset;
  if (manifest.theme.kind === "import") {
    return `imported (${manifest.theme.files.length} verified files)`;
  }
  return "none";
}

export function renderSummary(manifest: ScaffoldManifest): string {
  const header = [
    `Project: ${manifest.project.displayName} (${manifest.project.name})`,
    `Target: ${manifest.project.targetDirectory}`,
  ];
  const body =
    manifest.layout === "monorepo"
      ? [
          "Layout: monorepo",
          ...manifest.apps.map(
            (app) =>
              `App apps/${app.id}: ${app.stack.id} · port ${app.port} · integrations ${app.integrations.join(", ") || "none"}`,
          ),
          `Packages: ${manifest.packages.map((entry) => `packages/${entry}`).join(", ") || "none"}`,
        ]
      : [
          "Layout: standalone",
          `Stack: ${manifest.stack.id}`,
          `Integrations: ${manifest.integrations.join(", ") || "none"}`,
        ];
  return [
    ...header,
    ...body,
    `Operations: ${manifest.operations.join(", ") || "none"}`,
    `Theme: ${themeLabel(manifest)}`,
  ].join("\n");
}
