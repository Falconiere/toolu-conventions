import type { ScaffoldManifest } from "./manifest";

export function renderSummary(manifest: ScaffoldManifest): string {
  const theme =
    manifest.theme.kind === "preset"
      ? manifest.theme.preset
      : manifest.theme.kind === "import"
        ? `imported (${manifest.theme.files.length} verified files)`
        : "none";
  return [
    `Project: ${manifest.project.displayName} (${manifest.project.name})`,
    `Target: ${manifest.project.targetDirectory}`,
    `Stack: ${manifest.stack.id}`,
    `Integrations: ${manifest.integrations.join(", ") || "none"}`,
    `Operations: ${manifest.operations.join(", ") || "none"}`,
    `Theme: ${theme}`,
  ].join("\n");
}
