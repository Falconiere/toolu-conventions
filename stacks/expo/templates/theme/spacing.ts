// Spacing, radius, and layout scale — CodaSignal "Signal" language. Use these
// instead of magic numbers so rhythm stays consistent. Rationale: the kit's
// DESIGN.md. Import directly: import { spacing, radii } from '@/ui/theme/spacing';

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

// Radius encodes what a thing IS, not how big it is. No pill buttons, no soft
// blobs. `full` is for dots, radio rings and slider knobs only. Identical to the
// web kit — radius never compresses.
export const radii = {
  xs: 3, // buttons, tags, pagination chips, tooltips
  sm: 4, // fields, swatches, banners, key caps
  md: 6, // insets — code blocks, toasts, small tiles
  lg: 10, // cards in a row
  xl: 12, // panels, sheets
  xxl: 14, // feature panels — the product-shot device
  full: 9999,
} as const;

// Depth is a 1px line. On a light band a panel adds one shadow (`shadow` in
// theme/colors.ts); on a dark band, never.
export const borderWidth = {
  hairline: 1,
} as const;

// Screen-level rhythm. Native compresses the PAGE scale only — control geometry
// below is identical to the web kit, because a control is the same object.
export const layout = {
  screenPadding: 24,
  sectionY: 48,
  sectionYLg: 64,

  /** Band rules: 4 columns on a wide surface, 2 at phone width. */
  bandRuleColumns: 2,

  /** Marketing field height. */
  fieldHeight: 42,
  /** In-app field height — denser, still inside a 44pt hit area. */
  fieldHeightApp: 34,
  /** Icon-only control: a 30pt bordered box. An icon alone is illegal without it. */
  controlBox: 30,
  /** Minimum hit area on any interactive element. Same on web. */
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

  /** Floors. Prose never goes below 13; a mono label never below 9. */
  minTextSize: 13,
  minLabelSize: 9,
} as const;

// Stroke width scales with icon size, never with colour.
export const iconStroke = {
  16: 1,
  20: 1.25,
  24: 1.5,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
