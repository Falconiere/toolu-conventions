// Type scale. Plain TS with no runtime/type dependency so it validates on its
// own. `family` assumes a custom font loaded via expo-font in app.config; swap
// the names to your chosen font (the design pass picks it). Falls back to the
// system font until fonts are wired. Import directly:
//   import { typography } from '@/ui/theme/typography';

// A structural subset of react-native's TextStyle — kept local so this token file
// has zero imports. The objects below stay assignable to TextStyle at the use
// site (e.g. src/ui/text.tsx), so styles compose without a cast.
interface TypeToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const;

type Variant = 'display' | 'title' | 'body' | 'bodyStrong' | 'caption' | 'button';

export const typography: Record<Variant, TypeToken> = {
  display: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fontFamily.semibold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 },
};

export type TypographyVariant = Variant;
