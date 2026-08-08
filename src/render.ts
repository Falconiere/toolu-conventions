const RESERVED_PLACEHOLDER = /\{\{(TOOLU_[A-Z0-9_]+)\}\}/g;

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
