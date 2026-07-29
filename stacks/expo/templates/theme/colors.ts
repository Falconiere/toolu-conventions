// Color tokens — CodaSignal "Signal" language. Plain TS, no styling library. Import directly:
//   import { colors } from '@/ui/theme/colors';
//
// Two bands + one signal. The rationale lives in the kit's DESIGN.md; this file
// is the concrete source of truth. Same contract as the web kit, with one rename:
// `primaryPressed` here is `primaryHover` there — hover is not a native state.
//
// A screen is built from full-bleed BANDS that alternate dark and light. Each
// band owns its own token set and no component straddles the seam, so every
// primitive must read correctly in both. `palette` is the raw ramp — components
// never read it. They read the semantic maps: `colors` (dark band, the default)
// or `colorsLight` (light band).
//
// The signal is the single chromatic note. It ships in four temperatures
// (`signalThemes`); a theme swaps the signal steps and NOTHING else — bands, ink,
// lines, radius, type and motion are fixed. Pick one per product and stay there.

export const palette = {
  // Dark band ramp — near-black through to full ink.
  bandDark: '#0e0f0d',
  panelDark: '#1f1f1f',
  hoverDark: '#131511',
  ruleDark: '#191b17', // vertical band rules — the quarter-width grid
  lineHeaderDark: '#1a1c18', // section header rules
  disabledDark: '#1a1c18',
  lineDark: '#1e201c', // inner rules inside a panel
  linePanelDark: '#23251f', // panel borders, inset borders
  seamDark: '#262922', // crosshair marks at band seams
  lineStrongDark: '#33362e', // secondary-button border, unchecked box, key caps
  inkDisabledDark: '#3e4139',
  inkFaintDark: '#52554e',
  inkSoftDark: '#6c6f68',
  inkMutedDark: '#8a8d86',
  inkDark: '#f2f2ef',
  inkHoverDark: '#d0d1ce', // ink @ 86% over the dark band — the primary pressed fill

  // Light band ramp — warm paper through to full ink.
  bandLight: '#f2f2ee',
  panelLight: '#ffffff',
  hoverLight: '#f7f7f3',
  disabledLight: '#f7f7f3',
  skeletonLight: '#f0f0ea',
  lineInnerLight: '#ecece5', // inner rules, skeleton bars, rest-state meter track
  ruleLight: '#e6e6df', // vertical band rules
  lineLight: '#e3e3dc', // panel borders
  seamLight: '#dcdcd4',
  inkDisabledLight: '#b3b5ab',
  inkFaintLight: '#8c8e85',
  inkMutedLight: '#55574f',
  inkLight: '#16170f',
  inkHoverLight: '#2c2e24', // the primary pressed fill on a light band

  // Status. FIXED — these never theme, because a reader has to learn them once.
  // `live` is the one status that takes the signal, so it is not listed here.
  degraded: '#c99a3a',
  incident: '#c9553a',
} as const;

/** One signal temperature. `wash` backs dark bands, `washLight` backs light ones. */
export interface SignalTheme {
  signal: string;
  /** One step up — pressed, and the signal ink on a light band's lift state. */
  lift: string;
  /** One step down — the band-correct signal ink on light, where full signal fails contrast. */
  dim: string;
  /** Fill behind a signal chip / current step, on a dark band. */
  wash: string;
  /** The same fill on a light band. */
  washLight: string;
}

/**
 * Four temperatures, one grammar. The hue arc stays green → cyan → indigo, clear
 * of amber and red so the signal never collides with a status colour.
 */
export const signalThemes = {
  /** Default. Delivery, health, uptime. */
  jade: {
    signal: '#43c98b',
    lift: '#7be0b0',
    dim: '#2e9c6b',
    wash: '#12241c',
    washLight: '#e6f2eb',
  },
  /** Data-dense tools, read-only surfaces. */
  blueprint: {
    signal: '#45b4cc',
    lift: '#7ed6e6',
    dim: '#2c8aa0',
    wash: '#0f2229',
    washLight: '#e3eff3',
  },
  /** Internal and AI surfaces. Never marketing. */
  ion: {
    signal: '#9a8cf0',
    lift: '#c0b6ff',
    dim: '#6c5dd0',
    wash: '#17142b',
    washLight: '#ebe8fa',
  },
  /** The no-signal theme: contrast does the pointing. Print, docs, one-ink output. */
  chalk: {
    signal: '#f2f2ef',
    lift: '#ffffff',
    dim: '#16170f',
    wash: '#1f211c',
    washLight: '#e6e6df',
  },
} as const satisfies Record<string, SignalTheme>;

export type SignalThemeName = keyof typeof signalThemes;

/** The shipped default. One signal per product — change it here, in one place. */
export const defaultSignal: SignalThemeName = 'jade';

const signal = signalThemes[defaultSignal];

/** Semantic token contract. Both bands implement it, so screens swap band by map. */
export interface SemanticColors {
  /** The band itself — full-bleed, owns the screen or section. */
  background: string;
  /** Floating panel on the band: card, sheet, form group. */
  surface: string;
  /** Recessed inside a panel: field fill, code block. */
  surfaceInset: string;
  /** Row press feedback. The only background change any list row makes. */
  surfaceHover: string;

  text: string;
  textMuted: string;
  /** Sub-copy under a row title, tab labels, glyph arrows. */
  textSoft: string;
  /**
   * Labels and metadata ONLY. Measured 2.5:1 on the dark band and 1.9:1 on the
   * light one — both fail AA for copy, and the light step is under the 3:1
   * non-text floor too, so on a light band nothing a reader must parse may sit
   * on it. A label that carries an instruction moves up to `textSoft` (3.0:1 on
   * light) or `textMuted`.
   */
  textFaint: string;
  textInverse: string;

  /** Primary action — inverts with the band (ink fill on light, paper fill on dark). */
  primary: string;
  primaryPressed: string;
  onPrimary: string;

  /**
   * The signal, at the step this band can actually render. Three jobs only: the
   * second line of a heading, the current/live item, and the number in a
   * numbered list. It never fills a button and never tints a surface.
   */
  accent: string;
  /** Pressed / one step brighter. */
  accentLift: string;
  /** Wash behind a signal chip, current step, or focus ring. */
  accentWash: string;

  /** Current, healthy, running. The only status that takes the signal. */
  success: string;
  /** Slow, retrying, over budget. Dot, border or mono label — never a fill. */
  warning: string;
  /** Down, failed, destructive. Also owns the destructive button border. */
  danger: string;
  onDanger: string;
  /** Queued, paused, not started. Absence of colour is a state. */
  idle: string;

  /** Panel and control borders. */
  border: string;
  /** Rules INSIDE a panel — one step quieter than its own edge. */
  borderInner: string;
  /** Secondary-button border, unchecked box. */
  borderStrong: string;
  /** The quarter-width vertical band rules. */
  grid: string;
  /** Crosshair marks at the band seams. */
  seam: string;
  /** Paired with `layout.focusRing` — a 3px ring outside a 1px signal border. */
  focusRing: string;

  disabledFill: string;
  disabledText: string;
}

/** Dark band — the default. */
export const colors: SemanticColors = {
  background: palette.bandDark,
  surface: palette.panelDark,
  surfaceInset: palette.bandDark,
  surfaceHover: palette.hoverDark,

  text: palette.inkDark,
  textMuted: palette.inkMutedDark,
  textSoft: palette.inkSoftDark,
  textFaint: palette.inkFaintDark,
  textInverse: palette.bandDark,

  primary: palette.inkDark,
  primaryPressed: palette.inkHoverDark,
  onPrimary: palette.bandDark,

  accent: signal.signal,
  accentLift: signal.lift,
  accentWash: signal.wash,

  success: signal.signal,
  warning: palette.degraded,
  danger: palette.incident,
  onDanger: palette.bandDark,
  idle: palette.inkFaintDark,

  border: palette.linePanelDark,
  borderInner: palette.lineDark,
  borderStrong: palette.lineStrongDark,
  grid: palette.ruleDark,
  seam: palette.seamDark,
  focusRing: signal.wash,

  disabledFill: palette.disabledDark,
  disabledText: palette.inkDisabledDark,
};

/** Light band. Same contract, inverted surfaces, signal one step down. */
export const colorsLight: SemanticColors = {
  background: palette.bandLight,
  surface: palette.panelLight,
  surfaceInset: palette.bandLight,
  surfaceHover: palette.hoverLight,

  text: palette.inkLight,
  textMuted: palette.inkMutedLight,
  textSoft: palette.inkFaintLight,
  textFaint: palette.inkDisabledLight,
  textInverse: palette.bandLight,

  primary: palette.inkLight,
  primaryPressed: palette.inkHoverLight,
  onPrimary: palette.bandLight,

  // Full signal measures 3.1:1 on paper — headings at 24px/600 and up only. The
  // dim step is what a light band uses everywhere else.
  accent: signal.dim,
  accentLift: signal.signal,
  accentWash: signal.washLight,

  success: signal.dim,
  warning: palette.degraded,
  danger: palette.incident,
  onDanger: palette.bandLight,
  idle: palette.inkDisabledLight,

  border: palette.lineLight,
  borderInner: palette.lineInnerLight,
  borderStrong: palette.inkDisabledLight,
  grid: palette.ruleLight,
  seam: palette.seamLight,
  focusRing: signal.washLight,

  disabledFill: palette.disabledLight,
  disabledText: palette.inkDisabledLight,
};

/** A structural subset of react-native's ViewStyle shadow props — kept local so
 *  this token file has zero imports. */
interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** Android has no shadow colour or offset — only this. */
  elevation: number;
}

/**
 * Shadows are a LIGHT-BAND device. A panel on a dark band drops the shadow and
 * keeps its border — that is the only difference between the two treatments.
 */
export const shadow = {
  /** Cards, form groups. */
  card: {
    shadowColor: '#14160f',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.07,
    shadowRadius: 44,
    elevation: 3,
  },
  /** The standard panel. */
  panel: {
    shadowColor: '#14160f',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.09,
    shadowRadius: 60,
    elevation: 6,
  },
} as const satisfies Record<string, ShadowToken>;

export type ColorToken = keyof SemanticColors;
