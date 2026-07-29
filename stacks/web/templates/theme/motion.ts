/** Motion tokens — CodaSignal "Signal" language. Import: import { easing, duration } from '@/ui/theme/motion'. */

// Motion measures; it never performs. Nothing bounces, nothing shimmers, nothing
// spins. Hover changes colour or border in 140ms, disclosure opens in 220ms, live
// dots blink in steps, and press is a 1px nudge — that is the whole tactile
// vocabulary. Rationale: the kit's DESIGN.md.

export const easing = {
  /** The house curve, used everywhere. There is no second easing. */
  signal: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Live dots and the terminal cursor — a hard on/off, not a fade. */
  blink: 'steps(1, end)',
} as const;

/** Milliseconds. */
export const duration = {
  /** Hover and focus. Colour and border only — never size, never shadow. */
  hover: 140,
  /** Disclosure rows, panel swap, toggle knob. */
  disclosure: 220,
  /** A progress bar moving to a new real value. */
  progress: 800,
  /** Live dot / cursor blink cycle. */
  blink: 1800,
  /** A toast holds this long, then leaves. No progress bar on it. */
  toast: 4000,
} as const;

/** Ready-made CSS `transition` values for the common cases. */
export const transition = {
  hover: `color ${duration.hover}ms ${easing.signal}, border-color ${duration.hover}ms ${easing.signal}, background-color ${duration.hover}ms ${easing.signal}`,
  /** Primary buttons dip opacity instead of swapping a fill. */
  opacity: `opacity ${duration.hover}ms ${easing.signal}`,
  disclosure: `transform ${duration.disclosure}ms ${easing.signal}, opacity ${duration.disclosure}ms ${easing.signal}`,
  progress: `width ${duration.progress}ms ${easing.signal}`,
} as const;

/** Primary-button hover: the fill dips rather than changing colour. */
export const hoverOpacity = 0.86;

/** Press feedback. A 1px nudge down — never a shadow, never a scale. */
export const pressOffset = '1px';

// Honour `@media (prefers-reduced-motion: reduce)`: the blink becomes static (the
// dot stays at full opacity), the progress bar jumps to its value, and disclosure
// opens without a transition.
