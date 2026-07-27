// Button primitive — variants + sizes, theme-token styled, accessible by default.
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/text';
import { colors, type ColorToken } from '@/ui/theme/colors';
import { disabledOpacity, pressedOpacity } from '@/ui/theme/motion';
import { borderWidth, layout, radii, spacing } from '@/ui/theme/spacing';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const FILL: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surfaceMuted,
  destructive: colors.danger,
  ghost: 'transparent',
};

const PRESSED_FILL: Record<Variant, string> = {
  primary: colors.primaryPressed,
  secondary: colors.surface,
  destructive: colors.dangerPressed,
  ghost: colors.surfaceMuted,
};

// `secondary` sits between two adjacent neutrals, so its fill swap alone is a ~3%
// delta — imperceptible. It gets an opacity dip on top; the other variants have a
// real fill change already and would double-signal.
const PRESS_DIMS: Record<Variant, boolean> = {
  primary: false,
  secondary: true,
  destructive: false,
  ghost: false,
};

// Drives both the label and the loading spinner — `onPrimary` is ink on the night
// tone, so a hardcoded spinner color would vanish on ghost/secondary fills.
const LABEL_COLOR: Record<Variant, ColorToken> = {
  primary: 'onPrimary',
  secondary: 'text',
  destructive: 'onDanger',
  ghost: 'text',
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={hitSlopFor(size)}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: pressed ? PRESSED_FILL[variant] : FILL[variant] },
        pressed && PRESS_DIMS[variant] && { opacity: pressedOpacity },
        variant === 'ghost' && styles.ghostBorder,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors[LABEL_COLOR[variant]]} />
        ) : (
          <Text variant="button" color={LABEL_COLOR[variant]}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ghostBorder: { borderWidth: borderWidth.hairline, borderColor: colors.borderStrong },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: disabledOpacity },
});
