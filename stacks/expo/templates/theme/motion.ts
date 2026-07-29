// Motion tokens — CodaSignal "Signal" language. Import directly:
//   import { duration, SIGNAL_BEZIER } from '@/ui/theme/motion';
//
// Motion measures; it never performs. Nothing bounces, nothing shimmers, nothing
// spins. Press changes colour in 140ms, disclosure opens in 220ms, live dots
// blink in steps, and press feedback is a 1pt nudge — that is the whole tactile
// vocabulary. Rationale: the kit's DESIGN.md.
//
// `SIGNAL_BEZIER` is the house curve and the only one. Feed it to
// `Easing.bezier(...SIGNAL_BEZIER)` (react-native / reanimated) at the use site
// so this token file keeps zero imports.

/** cubic-bezier(0.2, 0, 0, 1) — the same curve the web kit ships. */
export const SIGNAL_BEZIER: readonly [number, number, number, number] = [0.2, 0, 0, 1];

/** Milliseconds. */
export const duration = {
  /** Press and focus. Colour and border only — never size, never shadow. */
  hover: 140,
  /** Disclosure rows, sheet swap, toggle knob. */
  disclosure: 220,
  /** A progress bar moving to a new real value. */
  progress: 800,
  /** Live dot / cursor blink cycle — `Easing.step0`, looping. */
  blink: 1800,
  /** A toast holds this long, then leaves. No progress bar on it. */
  toast: 4000,
} as const;

/** Primary-button press: the fill dips rather than changing colour. */
export const pressedOpacity = 0.86;

/** Opacity applied to a disabled surface. */
export const disabledOpacity = 0.5;

/** Press feedback. A 1pt nudge down — never a shadow, never a scale. */
export const pressOffset = 1;

// Honour the OS setting: check `AccessibilityInfo.isReduceMotionEnabled()` and
// render the blink static (dot at full opacity), the progress bar at its value,
// and disclosure without a transition.
