// Spacing, radius, and layout scale — "Spec Sheet" language. Use these instead of
// magic numbers so rhythm stays consistent. Rationale: the kit's DESIGN.md.
// Import directly: import { spacing, radii } from '@/ui/theme/spacing';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// Low radii by design — no pill buttons, no soft blobs. `full` is for status dots
// and avatars only.
export const radii = {
  xs: 3, // kbd chips
  sm: 4, // inline emphasis tokens
  md: 8, // buttons, inputs, cards
  lg: 12, // large panels, sheets
  full: 9999,
} as const;

// Depth is a 1px line, never a shadow.
export const borderWidth = {
  hairline: 1,
} as const;

// Screen-level rhythm. Mobile compresses the web section scale.
export const layout = {
  screenPadding: 24,
  sectionY: 48,
  sectionYLg: 64,
  minTouchTarget: 44,
  /** Spruce focus ring width — paired with `colors.focusRing`. */
  focusRing: 4,

  // Schematic motif dimensions — see DESIGN.md "Schematic motifs". Same values as
  // the web kit; the grid wash is web-only and has no token here.
  /** Leading hairline rule on a section sigil. */
  sigilRule: 28,
  /** Status dot diameter. */
  statusDot: 6,
  /** `dt` column width in a spec strip. */
  specStripLabel: 80,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
