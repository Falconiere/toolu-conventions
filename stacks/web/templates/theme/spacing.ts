/** Spacing, radius, and layout scale (px) — "Spec Sheet" language. Import: import { spacing, radii } from '@/ui/theme/spacing'. */

// Tokens over magic numbers. Rationale: the kit's DESIGN.md.

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

/** Low radii by design — no pill buttons, no soft blobs. `full` is for status dots only. */
export const radii = {
  xs: 3, // kbd chips
  sm: 4, // inline emphasis tokens
  md: 8, // buttons, inputs, cards
  lg: 12, // large panels
  full: 9999, // dots and avatars only
} as const;

/** Depth is a 1px line, never a blur. */
export const borderWidth = {
  hairline: 1,
} as const;

/** Page-level rhythm — container, gutters, section spacing, atmosphere. */
export const layout = {
  containerMaxWidth: 1280,
  gutter: 24, // < 640px
  gutterSm: 32, // >= 640px
  gutterLg: 64, // >= 1024px
  sectionY: 96,
  sectionYLg: 128,
  sectionYXl: 141,
  /** Hairline grid wash cell, masked by a radial gradient. */
  gridCell: 64,
  /** Fixed-header offset for anchor scrolling. */
  scrollPaddingTop: 80,
  /** Spruce focus ring width — paired with `colors.focusRing`. */
  focusRing: 4,
  /** Minimum hit area on any interactive element. Same on native. */
  minTouchTarget: 44,

  // Schematic motif dimensions — see DESIGN.md "Schematic motifs".
  /** Leading hairline rule on a section sigil. */
  sigilRule: 28,
  /** Status dot diameter. */
  statusDot: 6,
  /** `dt` column width in a spec strip. */
  specStripLabel: 80,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
