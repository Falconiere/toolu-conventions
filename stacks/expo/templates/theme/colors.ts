// Color tokens. Plain TS — no styling library. Import directly:
//   import { colors } from '@/ui/theme/colors';
//
// These are PLACEHOLDER values. The design pass (SETUP.md Phase 7) replaces them
// with the project's real palette from the intake design context. Avoid pure
// #000 / #fff — tint neutrals toward the brand hue for subconscious cohesion.

export const colors = {
  // Surfaces
  background: '#0b0d12',
  surface: '#151821',
  surfaceMuted: '#1d212c',

  // Text
  text: '#f5f6f8',
  textMuted: '#9aa1ad',
  textInverse: '#0b0d12',

  // Brand
  primary: '#3b82f6',
  primaryPressed: '#2f6fd6',
  onPrimary: '#ffffff',

  // Feedback
  danger: '#ef4444',
  dangerPressed: '#d23b3b',
  success: '#22c55e',
  warning: '#f59e0b',

  // Lines & disabled
  border: '#2a2f3a',
  disabledFill: '#2a2f3a',
  disabledText: '#6b7280',
} as const;

export type ColorToken = keyof typeof colors;
