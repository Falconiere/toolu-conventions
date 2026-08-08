/** Native renderer for the canonical stroke icon set. */
import { SvgXml } from 'react-native-svg';
import { colors, type ColorToken } from '@/ui/theme/colors';
import { iconStroke, icons, type IconName, type IconSize } from '@/ui/theme/icons';

interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly color?: ColorToken;
}

/** Renders one theme-aware icon with the shared construction rules. */
export function Icon({ name, size = 'md', color = 'text' }: IconProps) {
  const value = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors[color]}" stroke-width="${iconStroke[size]}" stroke-linecap="square" stroke-linejoin="miter">${icons[name]}</svg>`;
  const pixels = size === 'sm' ? 16 : size === 'lg' ? 28 : 24;
  return <SvgXml width={pixels} height={pixels} xml={value} />;
}
