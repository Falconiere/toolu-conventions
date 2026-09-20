const RESERVED_PLACEHOLDER = /\{\{(TOOLU_[A-Z0-9_]+)\}\}/g;

/** Escapes the contents of an existing double-quoted JavaScript string. */
export function escapeDoubleQuotedString(value: string): string {
  // Generated sources are formatted with `singleQuote: false`, so the string a
  // display name lands in is double-quoted — which is exactly what JSON emits:
  // quotes, backslashes and control characters escaped, apostrophes literal.
  return JSON.stringify(value).slice(1, -1);
}

/** Safe in HTML text/attributes and Astro text (where braces start expressions). */
export function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

export class ReservedPlaceholderError extends Error {
  override name = "ReservedPlaceholderError";
}

export function renderTemplate(source: string, values: Readonly<Record<string, string>>): string {
  return source.replaceAll(RESERVED_PLACEHOLDER, (_match, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new ReservedPlaceholderError(`unknown reserved placeholder: ${name}`);
    return value;
  });
}

export function assertNoReservedPlaceholders(source: string, path: string): void {
  const match = RESERVED_PLACEHOLDER.exec(source);
  RESERVED_PLACEHOLDER.lastIndex = 0;
  if (match !== null) {
    throw new ReservedPlaceholderError(`unresolved reserved placeholder ${match[1]} in ${path}`);
  }
}
