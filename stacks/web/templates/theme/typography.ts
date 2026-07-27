/** Type scale — "Spec Sheet" language. Plain CSS-ready tokens, no styling library. Import: import { typography, fontFamily } from '@/ui/theme/typography'. */

// Geist Sans for display + body, Geist Mono for every label, index, chip,
// coordinate, dimension, and numeric readout. No italic anywhere — emphasis is a
// mono uppercase token or a spruce underline. Rationale: the kit's DESIGN.md.
//
// `family` values reference CSS custom properties set by next/font (or a plain
// @font-face) with a full fallback stack, so tokens work before fonts load.

export const fontFamily = {
  sans: 'var(--font-sans, "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  mono: 'var(--font-mono, "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace)',
} as const;

/** 500 is the display weight — size carries emphasis, weight stays calm. 700 is banned. */
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

/** Negative tracking scales with size; the mono meta layer tracks wide and positive. */
export const letterSpacing = {
  display: '-0.035em',
  heading: '-0.025em',
  tight: '-0.01em',
  normal: '0em',
  button: '0.02em',
  chip: '0.06em',
  link: '0.12em',
  label: '0.16em',
} as const;

interface TypeStyle {
  fontFamily: string;
  /** `clamp()` on display sizes — they scale with the viewport; body does not. */
  fontSize: string;
  /** Unitless: display is nearly solid (1.02–1.05), prose breathes (1.55–1.65). */
  lineHeight: string;
  fontWeight: number;
  letterSpacing: string;
  textTransform?: 'uppercase';
  /** Numbers are readings, not words. */
  fontVariantNumeric?: 'tabular-nums';
}

type Variant =
  | 'displayLg'
  | 'display'
  | 'title'
  | 'subtitle'
  | 'lead'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'button'
  | 'label'
  | 'chip'
  | 'dimension'
  | 'code';

export const typography: Record<Variant, TypeStyle> = {
  // Display — sans, weight 500, tight tracking, near-solid leading.
  displayLg: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2.75rem, 6.5vw, 5.5rem)',
    lineHeight: '1.02',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.display,
  },
  display: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2.5rem, 5.6vw, 5.125rem)',
    lineHeight: '1.02',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.display,
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2rem, 3.6vw, 3.2rem)',
    lineHeight: '1.05',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.display,
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: '1.125rem',
    lineHeight: '1.4',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.tight,
  },

  // Prose.
  lead: {
    fontFamily: fontFamily.sans,
    fontSize: '1.125rem',
    lineHeight: '1.55',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: '1rem',
    lineHeight: '1.65',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodyStrong: {
    fontFamily: fontFamily.sans,
    fontSize: '1rem',
    lineHeight: '1.65',
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: '0.875rem',
    lineHeight: '1.65',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  button: {
    fontFamily: fontFamily.sans,
    fontSize: '0.875rem',
    lineHeight: '1.25',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.button,
    textTransform: 'uppercase',
  },

  // Mono meta layer — labels, sigils, chips, dimensions. Never prose.
  label: {
    fontFamily: fontFamily.mono,
    fontSize: '0.6875rem',
    lineHeight: '1.5',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.label,
    textTransform: 'uppercase',
  },
  chip: {
    fontFamily: fontFamily.mono,
    fontSize: '0.6875rem',
    lineHeight: '1.5',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.chip,
    textTransform: 'uppercase',
  },
  dimension: {
    fontFamily: fontFamily.mono,
    fontSize: '0.875rem',
    lineHeight: '1.5',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.button,
    fontVariantNumeric: 'tabular-nums',
  },
  code: {
    fontFamily: fontFamily.mono,
    fontSize: '0.875rem',
    lineHeight: '1.6',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums',
  },
};

export type TypographyVariant = Variant;
