// Motion tokens — "Spec Sheet" language. Import directly:
//   import { duration, SPEC_BEZIER } from '@/ui/theme/motion';
//
// `SPEC_BEZIER` is the house curve: fast out, long settle. Feed it to
// `Easing.bezier(...SPEC_BEZIER)` (react-native / reanimated) at the use site so
// this token file keeps zero imports. Rationale: the kit's DESIGN.md.
//
// Press feedback is a tint or a hairline, never a shadow.

/** cubic-bezier(0.16, 1, 0.3, 1) — the same curve the web kit ships. */
export const SPEC_BEZIER: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Milliseconds. */
export const duration = {
  fast: 200, // color, border, opacity
  base: 300, // press states, transforms, surfaces
  reveal: 700, // staggered list items
  revealSlow: 800, // screen enter
  pulse: 2400, // status dot halo — Easing.inOut(Easing.ease), looping
  blink: 1050, // cursor block after a live token — Easing.step0, looping
} as const;

/** Per-item delay step for staggered reveals. */
export const staggerStep = 120;

/** Opacity applied to a pressed surface. */
export const pressedOpacity = 0.7;

/** Opacity applied to a disabled surface. */
export const disabledOpacity = 0.5;

// Honour the OS setting: check `AccessibilityInfo.isReduceMotionEnabled()` and
// render reveals in their final state — no opacity ramp, no transform.
