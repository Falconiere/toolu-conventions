// Text primitive — renders a theme type variant + color token over RN Text.
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type ColorToken } from '@/ui/theme/colors';
import { typography, type TypographyVariant } from '@/ui/theme/typography';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
}

/**
 * Typographic primitive. Renders a theme type variant + color token.
 * Prefer this over raw <Text> so type/color stays consistent.
 */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  return <RNText style={[typography[variant], { color: colors[color] }, style]} {...rest} />;
}
