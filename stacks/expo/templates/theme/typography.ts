// Type scale — "Spec Sheet" language. Plain TS with no runtime/type dependency
// so it validates on its own. Import directly:
//   import { typography } from '@/ui/theme/typography';
//
// Geist Sans for display + body, Geist Mono for every label, index, chip,
// coordinate, dimension, and numeric readout. No italic anywhere. Display weight
// is Medium (500) — size carries emphasis, weight stays calm. Rationale: the
// kit's DESIGN.md.
//
// The `fontFamily` names below are the keys registered with expo-font in
// app.config (SETUP.md Phase 7). Until the font files ship, RN falls back to the
// system face — layout still holds because the scale is metric-driven.

// A structural subset of react-native's TextStyle — kept local so this token file
// has zero imports. The objects below stay assignable to TextStyle at the use
// site (e.g. src/ui/text.tsx), so styles compose without a cast.
interface TypeToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** px, not em — RN has no relative tracking. Negative on display, positive on mono meta. */
  letterSpacing: number;
  textTransform?: 'uppercase';
  /** Numbers are readings, not words — tabular figures wherever digits render. */
  fontVariant?: ['tabular-nums'];
}

export const fontFamily = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  mono: 'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
} as const;

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
  | 'dimension';

export const typography: Record<Variant, TypeToken> = {
  // Display — Medium, tight tracking (-0.035em), near-solid leading.
  displayLg: { fontFamily: fontFamily.medium, fontSize: 48, lineHeight: 49, letterSpacing: -1.68 },
  display: { fontFamily: fontFamily.medium, fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  title: { fontFamily: fontFamily.medium, fontSize: 28, lineHeight: 29, letterSpacing: -0.98 },
  subtitle: { fontFamily: fontFamily.medium, fontSize: 18, lineHeight: 25, letterSpacing: -0.18 },

  // Prose.
  lead: { fontFamily: fontFamily.regular, fontSize: 18, lineHeight: 28, letterSpacing: 0 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 26, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 26, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 23, letterSpacing: 0 },
  button: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.28,
    textTransform: 'uppercase',
  },

  // Mono meta layer — labels, sigils, chips, dimensions. Never prose.
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
  },
  chip: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
  dimension: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.28,
    fontVariant: ['tabular-nums'],
  },
};

export type TypographyVariant = Variant;
