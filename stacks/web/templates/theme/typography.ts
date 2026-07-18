/** Type scale. Plain CSS-ready tokens (rem-based), no styling library. Import: import { typography, fontFamily } from '@/ui/theme/typography'. */

// `family` values reference CSS custom properties set by next/font (or a plain
// @font-face) with a system fallback, so tokens work before fonts load. The
// design pass fills in the real families and scale.

export const fontFamily = {
  sans: 'var(--font-sans, system-ui, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
} as const;

interface TypeStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
}

type Variant = 'display' | 'title' | 'body' | 'bodyStrong' | 'caption' | 'button';

export const typography: Record<Variant, TypeStyle> = {
  display: { fontSize: '2rem', lineHeight: '2.375rem', fontWeight: 700 },
  title: { fontSize: '1.375rem', lineHeight: '1.75rem', fontWeight: 600 },
  body: { fontSize: '1rem', lineHeight: '1.375rem', fontWeight: 400 },
  bodyStrong: { fontSize: '1rem', lineHeight: '1.375rem', fontWeight: 600 },
  caption: { fontSize: '0.8125rem', lineHeight: '1.125rem', fontWeight: 400 },
  button: { fontSize: '1rem', lineHeight: '1.25rem', fontWeight: 600 },
};

export type TypographyVariant = Variant;
