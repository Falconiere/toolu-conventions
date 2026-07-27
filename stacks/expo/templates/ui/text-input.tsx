// TextInput primitive — labeled input with focus + error states.
import { useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import { Text } from '@/ui/text';
import { colors } from '@/ui/theme/colors';
import { borderWidth, layout, radii, spacing } from '@/ui/theme/spacing';
import { fontFamily, typography } from '@/ui/theme/typography';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

/**
 * Labeled text input with focus + error states. Composes the Text primitive for
 * the label/error so typography stays consistent.
 */
export function TextInput({ label, error, style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  // Focus is spruce — the accent always marks state, never decoration.
  const borderColor = error !== undefined ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={styles.container}>
      {label !== undefined && (
        <Text variant="label" color="textSoft" style={styles.label}>
          {label}
        </Text>
      )}
      {/* Focus is the accent border PLUS a soft ring; the ring is always laid
          out (transparent when idle) so focusing never shifts the layout. */}
      <View style={[styles.ring, { borderColor: focused ? colors.focusRing : 'transparent' }]}>
        <RNTextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error !== undefined && (
        <Text variant="caption" color="danger" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { marginLeft: spacing.xs },
  ring: {
    borderWidth: layout.focusRing,
    borderRadius: radii.md + layout.focusRing,
  },
  input: {
    minHeight: layout.minTouchTarget,
    borderWidth: borderWidth.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
  },
  error: { marginLeft: spacing.xs },
});
