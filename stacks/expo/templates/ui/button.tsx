// Button primitive — variants + sizes, theme-token styled, accessible by default.
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/text';
import { colors, type ColorToken } from '@/ui/theme/colors';
import { radii, spacing } from '@/ui/theme/spacing';

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

const LABEL_COLOR: Record<Variant, ColorToken> = {
  primary: 'onPrimary',
  secondary: 'text',
  destructive: 'onPrimary',
  ghost: 'primary',
};

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };

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
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: pressed ? PRESSED_FILL[variant] : FILL[variant] },
        variant === 'ghost' && styles.ghostBorder,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
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
  ghostBorder: { borderWidth: 1, borderColor: colors.border },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
});
