/** Spacing, radius, and layout scale (px) — CodaSignal "Signal" language. Import: import { spacing, radii } from '@/ui/theme/spacing'. */

// Tokens over magic numbers. Rationale: the kit's DESIGN.md.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/**
 * Radius encodes what a thing IS, not how big it is. No pill buttons, no soft
 * blobs. `full` is for dots, radio rings and slider knobs only.
 */
export const radii = {
  xs: 3, // buttons, tags, pagination chips, tooltips
  sm: 4, // fields, swatches, banners, key caps
  md: 6, // insets — code blocks, terminals, toasts, small tiles
  lg: 10, // cards in a three-up row
  xl: 12, // panels
  xxl: 14, // feature panels — the product-shot device
  full: 9999,
} as const;

/** Depth is a 1px line. On a light band a panel adds one shadow; on dark, never. */
export const borderWidth = {
  hairline: 1,
} as const;

/** Where the layout changes shape. See DESIGN.md "Breakpoints" for what moves. */
export const breakpoints = {
  /** Full system: 1360 content, 48 gutter, display 68. */
  xl: 1400,
  /** Gutter 40. Three-up rows become two-up. */
  lg: 1120,
  /** Bands go single column. Index rows drop the spec column. */
  md: 860,
  /** Gutter 24, buttons full width, band rules halve to 50%. */
  sm: 600,
} as const;

/** Page-level rhythm — bands, gutters, the ruled backdrop, control geometry. */
export const layout = {
  containerMaxWidth: 1360,
  gutter: 24, // < 600
  gutterMd: 40, // 600 – 1400 — the default gutter, not a >= 1120 step
  gutterLg: 48, // >= 1400
  /** Top padding inside a band, below its header rule. */
  sectionY: 84,
  /** The same at <= 860. */
  sectionYSm: 56,
  /** Bottom padding — a band closes wider than it opens. */
  sectionBottom: 100,
  /** Padding on the band header rule (`§04 · patterns` ↔ `markers · rails`). */
  headerY: 16,

  /** The ruled backdrop: vertical rules every quarter of the band, 1px wide. */
  bandRuleStep: '25%',
  /** The same at <= 600 — the rules halve so they still read at phone width. */
  bandRuleStepSm: '50%',

  /** Marketing field height. */
  fieldHeight: 42,
  /** In-app field height — denser, still inside a 44px hit area. */
  fieldHeightApp: 34,
  /** Icon-only control: a 30px bordered box. An icon alone is illegal without it. */
  controlBox: 30,
  /** Minimum hit area on any interactive element. Same on native. */
  minTouchTarget: 44,
  /** An app list row may be 36 tall as long as its hit area reaches 44. */
  rowTarget: 36,
  /** Ring width outside the 1px signal focus border. No glow, no offset jump. */
  focusRing: 3,

  /** Status dot — live, degraded, incident, idle. */
  statusDot: 7,
  /** Icon grid: a 24 box with a 20 live area. */
  iconBox: 24,
  iconLive: 20,
  /** Progress bar in a panel; the thin meter under a loading count. */
  progressBar: 5,
  meter: 3,
  /** Slider track and knob. */
  slider: 4,
  sliderKnob: 14,
  /** Toggle track and knob. */
  toggleWidth: 42,
  toggleHeight: 22,
  toggleKnob: 16,

  /** Floors. Prose never goes below 13px; a mono label never below 9px. */
  minTextSize: 13,
  minLabelSize: 9,
} as const;

/** Stroke width scales with icon size, never with colour. */
export const iconStroke = {
  16: 1,
  20: 1.25,
  24: 1.5,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
