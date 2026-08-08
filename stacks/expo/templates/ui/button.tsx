// Button primitive — variants + sizes, theme-token styled, accessible by default.
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/text';
import { colors, type ColorToken } from '@/ui/theme/colors';
import { pressedOpacity } from '@/ui/theme/motion';
import { borderWidth, layout, radii, spacing } from '@/ui/theme/spacing';

type Variant = 'primary' | 'secondary' | 'destructive' | 'bracket';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

// Controls stay quiet, data does the talking: exactly ONE variant carries a fill,
// and the signal never fills a button. `destructive` is a border and an ink, not
// a red block. `bracket` is the quietest step — render its label as `[ Label ]`.
const FILL: Record<Variant, string> = {
  primary: colors.primary,
  secondary: 'transparent',
  destructive: 'transparent',
  bracket: 'transparent',
};

const BORDER: Record<Variant, string | undefined> = {
  primary: undefined,
  secondary: colors.borderStrong,
  destructive: colors.danger,
  bracket: undefined,
};

const LABEL_COLOR: Record<Variant, ColorToken> = {
  primary: 'onPrimary',
  secondary: 'text',
  destructive: 'danger',
  bracket: 'textMuted',
};

// Press is a colour move — never a shadow, never a scale. The filled variant dips
// its fill; the outlined ones lift a border or tint the row behind them.
const PRESSED_FILL: Record<Variant, string> = {
  primary: colors.primaryPressed,
  secondary: 'transparent',
  destructive: colors.surfaceHover,
  bracket: colors.surfaceHover,
};

const PRESSED_BORDER: Record<Variant, string | undefined> = {
  primary: undefined,
  secondary: colors.textSoft,
  destructive: colors.danger,
  bracket: undefined,
};

// `md` is the minimum touch target (44); sm/lg step off it by one spacing unit.
// `sm` is therefore shorter than the 44pt minimum and makes the difference up
// with hitSlop below.
const HEIGHT: Record<Size, number> = {
  sm: layout.minTouchTarget - spacing.sm,
  md: layout.minTouchTarget,
  lg: layout.minTouchTarget + spacing.sm,
};

/**
 * Vertical-only hit-area expansion that brings a sub-44pt box up to the minimum.
 * Vertical because horizontal growth would overlap an adjacent control's touch
 * area. Note RN clips the expansion to the parent view's bounds — a `sm` button
 * in a tight-fitting parent still needs padding on that parent to comply.
 */
function hitSlopFor(size: Size): { top: number; bottom: number } {
  const slop = Math.max(0, (layout.minTouchTarget - HEIGHT[size]) / 2);
  return { top: slop, bottom: slop };
}

/**
 * Button primitive with variants + sizes. Styles are colocated below via
 * StyleSheet — no styling library. Add a variant by extending the maps above.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const border = BORDER[variant];
  // Disabled is a real fill and a real ink, not a dimmed copy of the enabled
  // state — a washed-out control reads as "still loading" on a dark band.
  const labelColor: ColorToken = isDisabled ? 'disabledText' : LABEL_COLOR[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={hitSlopFor(size)}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: FILL[variant] },
        border !== undefined && { borderWidth: borderWidth.hairline, borderColor: border },
        pressed && { backgroundColor: PRESSED_FILL[variant] },
        pressed && { opacity: pressedOpacity },
        pressed && border !== undefined && { borderColor: PRESSED_BORDER[variant] },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors[labelColor]} />
        ) : (
          <Text variant="button" color={labelColor}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // 3pt — the button radius. Never a pill.
    borderRadius: radii.xs,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { backgroundColor: colors.disabledFill, borderColor: colors.disabledFill },
});
