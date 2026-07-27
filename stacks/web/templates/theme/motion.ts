/** Motion tokens — "Spec Sheet" language. Import: import { easing, duration } from '@/ui/theme/motion'. */

// `spec` is the house curve: fast out, long settle. Rationale: the kit's DESIGN.md.
// Hover NEVER adds a shadow — it adds a hairline, a spruce tint, or a -1px lift.

export const easing = {
  spec: 'cubic-bezier(0.16, 1, 0.3, 1)',
  standard: 'ease',
  inOut: 'ease-in-out', // status-dot pulse
  blink: 'steps(2, end)', // cursor block
} as const;

/** Milliseconds. */
export const duration = {
  fast: 200, // color, border, opacity
  base: 300, // buttons, transforms, surfaces
  reveal: 700, // viewport stagger items
  revealSlow: 800, // viewport fade-in-up
  pulse: 2400, // status dot halo
  blink: 1050, // cursor block
} as const;

/** Per-item delay step for staggered viewport reveals. */
export const staggerStep = 120;

/** Ready-made CSS `transition` values for the common cases. */
export const transition = {
  color: `color ${duration.fast}ms ${easing.standard}, border-color ${duration.fast}ms ${easing.standard}`,
  surface: `background-color ${duration.base}ms ${easing.spec}, transform ${duration.base}ms ${easing.spec}`,
  reveal: `opacity ${duration.revealSlow}ms ${easing.spec}, transform ${duration.revealSlow}ms ${easing.spec}`,
} as const;

/** Lift applied on hover instead of a shadow. */
export const hoverLift = '-1px';

// Every reveal must flatten to its final state under
// `@media (prefers-reduced-motion: reduce)` — no opacity ramp, no transform.
