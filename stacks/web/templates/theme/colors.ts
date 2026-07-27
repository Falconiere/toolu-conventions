/** Color tokens — "Spec Sheet" language. Plain TS, no styling library. Import: import { colors } from '@/ui/theme/colors'. */

// One neutral scale + ONE chromatic accent (spruce). The rationale lives in the
// kit's DESIGN.md; this file is the concrete source of truth.
//
// `palette` is the raw ramp — components never read it. They read the semantic
// maps: `colors` (night tone, the default) or `colorsLight` (paper tone).
// Surfaces alternate night/paper section by section, so every primitive must
// read correctly in both. Never pure #000 / #fff on a surface.

export const palette = {
  // Neutral charcoal scale — true neutral, no warm/cool cast.
  neutral50: '#fafafa',
  neutral100: '#f5f5f5',
  neutral200: '#e5e5e5',
  neutral300: '#d4d4d4',
  neutral400: '#a3a3a3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',
  neutral950: '#0a0a0a',

  // Brand neutrals.
  ink: '#1f1f1f',
  inkStrong: '#0a0a0a',
  night: '#1a1a1a',
  nightDeep: '#0f0f0f',
  nightRaised: '#1f1f1f', // night + 2% white — the raised-surface lift on dark
  paper: '#fafafa',
  cream: '#f4f4f4',
  shell: '#e8e8e8',

  // Signal accent — spruce. The only chromatic note in the system.
  spruce: '#3a8f6f',
  spruceSoft: 'rgba(58, 143, 111, 0.16)',
  spruceLine: 'rgba(58, 143, 111, 0.36)',
  spruceGlow: 'rgba(58, 143, 111, 0.08)',

  // Feedback ramp. Errors only ever render on light in the source system, so the
  // dark-tone steps are filled from the same scale for product surfaces.
  red200: '#fecaca',
  red400: '#f87171',
  red700: '#b91c1c',
  red900: '#7f1d1d',
  amber500: '#f59e0b', // the one token outside the palette — warnings only

  // Hairlines. Depth is a 1px line, never a blur.
  lineOnDark: 'rgba(255, 255, 255, 0.08)',
  lineOnDarkStrong: 'rgba(255, 255, 255, 0.18)',
  gridOnDark: 'rgba(255, 255, 255, 0.035)',
  gridOnLight: 'rgba(0, 0, 0, 0.04)',
} as const;

/** Semantic token contract. Both tones implement it, so primitives swap tone by map. */
export interface SemanticColors {
  background: string;
  backgroundDeep: string;
  surface: string;
  surfaceMuted: string;

  text: string;
  textMuted: string;
  /**
   * Tertiary. Labels and meta only — on the paper tone it measures 4.54:1 over
   * `surface` but only 3.87:1 over `background`, so it fails AA for small copy
   * on the page surface. Use `textMuted` for anything a user must read.
   */
  textSoft: string;
  textInverse: string;

  /** Primary action — inverts with the tone (paper on night, ink on paper). */
  primary: string;
  primaryHover: string;
  onPrimary: string;

  /** Spruce. Reserved for state, focus, and locators — never decoration. */
  accent: string;
  accentSoft: string;
  accentLine: string;
  accentGlow: string;

  danger: string;
  dangerHover: string;
  onDanger: string;
  /**
   * Spruce — a healthy state IS the signal state. Fill/dot/border only: at
   * 4.42:1 on night and 3.77:1 on paper it clears AA for large text and UI
   * graphics but NOT for small copy. Pair it with a neutral text label.
   */
  success: string;
  /** Fill/icon only — amber on a light surface is ~1.8:1 and unreadable as text. */
  warning: string;

  border: string;
  borderStrong: string;
  focusRing: string;
  grid: string;

  disabledFill: string;
  disabledText: string;
}

/** Night tone — the default surface. */
export const colors: SemanticColors = {
  background: palette.night,
  backgroundDeep: palette.nightDeep,
  surface: palette.nightRaised,
  surfaceMuted: palette.neutral800,

  text: palette.paper,
  textMuted: '#b7b7b7', // paper @ 70% over night
  textSoft: '#8a8a8a', // paper @ 50% over night
  textInverse: palette.ink,

  primary: palette.paper,
  primaryHover: palette.neutral200,
  onPrimary: palette.ink,

  accent: palette.spruce,
  accentSoft: palette.spruceSoft,
  accentLine: palette.spruceLine,
  accentGlow: palette.spruceGlow,

  danger: palette.red400,
  dangerHover: palette.red200,
  onDanger: palette.ink,
  success: palette.spruce,
  warning: palette.amber500,

  border: palette.lineOnDark,
  borderStrong: palette.lineOnDarkStrong,
  focusRing: palette.spruceSoft,
  grid: palette.gridOnDark,

  disabledFill: palette.neutral800,
  disabledText: palette.neutral500,
};

/** Paper tone — light sections. Same contract, inverted surfaces. */
export const colorsLight: SemanticColors = {
  background: palette.shell,
  backgroundDeep: palette.neutral200,
  surface: palette.paper,
  surfaceMuted: palette.cream,

  text: palette.ink,
  textMuted: palette.neutral600,
  textSoft: palette.neutral500,
  textInverse: palette.paper,

  primary: palette.ink,
  primaryHover: palette.neutral800,
  onPrimary: palette.paper,

  accent: palette.spruce,
  accentSoft: palette.spruceSoft,
  accentLine: palette.spruceLine,
  accentGlow: palette.spruceGlow,

  danger: palette.red700,
  dangerHover: palette.red900,
  onDanger: palette.paper,
  success: palette.spruce,
  warning: palette.amber500,

  border: palette.neutral300,
  borderStrong: palette.neutral400,
  focusRing: palette.spruceSoft,
  grid: palette.gridOnLight,

  disabledFill: palette.neutral200,
  disabledText: palette.neutral400,
};

/** The single sanctioned shadow. Depth is a hairline first, this second. */
export const shadow = {
  premium: '0 1px 2px rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.09)',
} as const;

export type ColorToken = keyof SemanticColors;
