// Type scale — CodaSignal "Signal" language. Plain TS with no runtime/type
// dependency so it validates on its own. Import directly:
//   import { typography } from '@/ui/theme/typography';
//
// One grotesk, two sizes of mono label. Archivo carries every heading, every
// number and all prose; JetBrains Mono carries labels, data, tags, glyphs and
// code — never a paragraph. No serif and no italic anywhere in the system.
// Rationale: the kit's DESIGN.md.
//
// Native compresses the display and title steps (`displayLg`…`subhead`) —
// everything from `body` down, including the whole mono meta layer, is identical
// to the web kit, so a component reads the same on both.
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
  regular: 'Archivo-Regular',
  medium: 'Archivo-Medium',
  semibold: 'Archivo-SemiBold',
  mono: 'JetBrainsMono-Regular',
  monoMedium: 'JetBrainsMono-Medium',
} as const;

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

export const typography: Record<Variant, TypeToken> = {
  // Display — Archivo 600, tight tracking, near-solid leading. Headings break in
  // two lines and only the SECOND line takes the signal colour.
  displayLg: {
    fontFamily: fontFamily.semibold,
    fontSize: 40,
    lineHeight: 41,
    letterSpacing: -1.52,
  },
  display: { fontFamily: fontFamily.semibold, fontSize: 32, lineHeight: 33, letterSpacing: -1.12 },

  // Figures. Every claim gets a number beside it, so numbers are a type role.
  statLg: {
    fontFamily: fontFamily.semibold,
    fontSize: 44,
    lineHeight: 40,
    letterSpacing: -1.98,
    fontVariant: ['tabular-nums'],
  },
  stat: {
    fontFamily: fontFamily.semibold,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.28,
    fontVariant: ['tabular-nums'],
  },

  // Titles. No quotation marks on a quote, no photo beside it.
  quote: { fontFamily: fontFamily.medium, fontSize: 22, lineHeight: 31, letterSpacing: -0.53 },
  subhead: { fontFamily: fontFamily.medium, fontSize: 19, lineHeight: 25, letterSpacing: -0.42 },

  // Prose. The workhorse, never wider than 52 characters, never a serif.
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 26, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 22, letterSpacing: 0 },

  // Mono meta layer. Labels, data, tags, code — never prose. 9px is the floor.
  marker: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 2.28, // 0.24em — section markers, once per section
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.9, // 0.2em — panel and field labels
    textTransform: 'uppercase',
  },
  tag: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.44, // 0.16em
    textTransform: 'uppercase',
  },
  data: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 16,
    letterSpacing: 1.68, // 0.16em — `FROM $40K · 6–12 WEEKS`
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.6, // 0.06em — rail lines `├─ … ─┤`. Not uppercase.
    fontVariant: ['tabular-nums'],
  },
  code: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 21,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  button: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.71, // 0.18em
    textTransform: 'uppercase',
  },
};

export type TypographyVariant = Variant;
