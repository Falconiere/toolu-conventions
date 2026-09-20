/** Joins conditional class names, dropping anything falsy. */

export type ClassValue = string | false | null | undefined;

// Deliberately minimal: no dedupe, no Tailwind conflict resolution. A
// component that needs those is describing a design-system merge problem,
// not a string-join problem, and reaching for `clsx`/`tailwind-merge` at that
// point is the right call rather than growing this function to match.
export function classNames(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
