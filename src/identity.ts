/**
 * Project identity derivations.
 *
 * The project name doubles as a product identity ("agavus.io") and as the seed
 * for identifiers that cannot hold a dot: npm package names and workspace
 * scopes, Cloudflare Worker names, Cargo package names, URL schemes and mobile
 * bundle identifiers. The raw name stays the identity; everything derived here
 * is dot-free.
 */

/** Lowercase segments joined by single dots or hyphens. */
export const PROJECT_NAME_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const PROJECT_NAME_RULE =
  "Use lowercase letters, numbers, and single hyphens or dots (for example agavus.io).";

/** Dot-free identifier used for npm names, workspace scopes and worker names. */
export function projectSlug(name: string): string {
  return name.replaceAll(".", "-");
}

/** Separator-free identifier used where only letters and digits are legal. */
export function compactName(name: string): string {
  return name.replaceAll(".", "").replaceAll("-", "");
}

/** Workspace package name for one app or package directory. */
export function workspacePackageName(name: string, member: string): string {
  return `@${projectSlug(name)}/${member}`;
}

/**
 * Reverse-DNS bundle identifier. A dotted name is read as a domain and
 * reversed ("agavus.io" -> "io.agavus.app"); a plain name keeps the previous
 * "com.<name>.app" shape. Segments must start with a letter, so a leading
 * digit is prefixed.
 */
export function bundleIdentifier(name: string): string {
  const segments = name.split(".").map((segment) => segment.replaceAll("-", ""));
  const ordered = segments.length > 1 ? [...segments].reverse() : ["com", segments[0] ?? ""];
  return [...ordered, "app"].map((segment) => segment.replace(/^(\d)/, "a$1")).join(".");
}

/** Production domain metadata default. A dotted name is already a domain. */
export function defaultDomain(name: string): string {
  return name.includes(".") ? name : `${name}.example.com`;
}

/**
 * Human-readable product name. A dotted name drops the domain suffix, so
 * "agavus.io" reads as "Agavus" rather than "Agavus Io".
 */
export function titleCaseProjectName(name: string): string {
  return (name.split(".")[0] ?? name)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
