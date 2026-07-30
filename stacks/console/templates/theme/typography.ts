/** Type scale — CodaSignal "Signal" language. Plain CSS-ready tokens, no styling library. Import: import { typography, fontFamily } from '@/ui/theme/typography'. */

// One grotesk, two sizes of mono label. Archivo carries every heading, every
// number and all prose; JetBrains Mono carries labels, data, tags, glyphs and
// code — never a paragraph. No serif and no italic anywhere in the system.
// Rationale: the kit's DESIGN.md.
//
// `family` values reference CSS custom properties declared in globals.css (fed
// by the self-hosted Fontsource packages) with a full fallback stack, so tokens
// work before the fonts load.

export const fontFamily = {
  sans: 'var(--font-sans, Archivo, Helvetica, -apple-system, BlinkMacSystemFont, sans-serif)',
  mono: 'var(--font-mono, "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace)',
} as const;

/** 600 is the display weight, 500 the title weight. 700 is banned — size carries emphasis. */
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

/**
 * Negative tracking on the grotesk, positive on the mono meta layer. The four
 * mono steps are not interchangeable: they encode what the text is.
 */
export const letterSpacing = {
  displayLg: '-0.038em',
  display: '-0.035em',
  stat: '-0.04em',
  statLg: '-0.045em',
  quote: '-0.024em',
  title: '-0.022em',
  normal: '0em',
  /** Rail lines, dimension brackets, credential facts. */
  meta: '0.06em',
  /** Tags, pagination, inline chips. */
  tag: '0.16em',
  /** Buttons and bracket links. */
  button: '0.18em',
  /** Panel and field labels. */
  label: '0.2em',
  /** Section markers — `— §04 · speed`. The widest step, used once per section. */
  marker: '0.24em',
} as const;

interface TypeStyle {
  fontFamily: string;
  /** `clamp()` on display sizes — they step down at 860 and 600. Prose does not scale. */
  fontSize: string;
  /** Unitless: display is near-solid (0.9–1.05), prose breathes (1.6–1.7). */
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
  | 'statLg'
  | 'stat'
  | 'quote'
  | 'subhead'
  | 'body'
  | 'bodySm'
  | 'marker'
  | 'label'
  | 'tag'
  | 'data'
  | 'meta'
  | 'code'
  | 'button';

export const typography: Record<Variant, TypeStyle> = {
  // Display — Archivo 600, tight tracking, near-solid leading. Headings break in
  // two lines and only the SECOND line takes the signal colour.
  displayLg: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2.5rem, 4.8vw, 4.25rem)', // 40 → 68
    lineHeight: '1.03',
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.displayLg,
  },
  display: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(1.875rem, 3.6vw, 3.125rem)', // 30 → 50
    lineHeight: '1.04',
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.display,
  },

  // Figures. Every claim gets a number beside it, so numbers are a type role.
  statLg: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2.75rem, 5vw, 4.125rem)', // 44 → 66
    lineHeight: '0.9',
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.statLg,
    fontVariantNumeric: 'tabular-nums',
  },
  stat: {
    fontFamily: fontFamily.sans,
    fontSize: 'clamp(2rem, 3vw, 2.5rem)', // 32 → 40
    lineHeight: '1',
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.stat,
    fontVariantNumeric: 'tabular-nums',
  },

  // Titles. No quotation marks on a quote, no photo beside it.
  quote: {
    fontFamily: fontFamily.sans,
    fontSize: '1.625rem', // 26
    lineHeight: '1.4',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.quote,
  },
  subhead: {
    fontFamily: fontFamily.sans,
    fontSize: '1.3125rem', // 21 — card titles, row titles
    lineHeight: '1.3',
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.title,
  },

  // Prose. The workhorse, never wider than 52 characters, never a serif.
  body: {
    fontFamily: fontFamily.sans,
    fontSize: '0.9375rem', // 15
    lineHeight: '1.7',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: '0.875rem', // 14 — captions under a panel, row sub-copy
    lineHeight: '1.6',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },

  // Mono meta layer. Labels, data, tags, code — never prose. 9px is the floor.
  marker: {
    fontFamily: fontFamily.mono,
    fontSize: '0.59375rem', // 9.5 — `— §04 · speed`, once per section
    lineHeight: '1.5',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.marker,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: '0.59375rem', // 9.5 — panel and field labels
    lineHeight: '1.5',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.label,
    textTransform: 'uppercase',
  },
  tag: {
    fontFamily: fontFamily.mono,
    fontSize: '0.5625rem', // 9 — the floor. Nothing mono goes below it.
    lineHeight: '1.5',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.tag,
    textTransform: 'uppercase',
  },
  data: {
    fontFamily: fontFamily.mono,
    fontSize: '0.65625rem', // 10.5 — `FROM $40K · 6–12 WEEKS`
    lineHeight: '1.5',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.tag,
    textTransform: 'uppercase',
    fontVariantNumeric: 'tabular-nums',
  },
  meta: {
    fontFamily: fontFamily.mono,
    fontSize: '0.625rem', // 10 — rail lines `├─ … ─┤`, credential facts. Not uppercase.
    lineHeight: '1.6',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.meta,
    fontVariantNumeric: 'tabular-nums',
  },
  code: {
    fontFamily: fontFamily.mono,
    fontSize: '0.75rem', // 12
    lineHeight: '1.75',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums',
  },
  button: {
    fontFamily: fontFamily.mono,
    fontSize: '0.59375rem', // 9.5
    lineHeight: '1.2',
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.button,
    textTransform: 'uppercase',
  },
};

export type TypographyVariant = Variant;
