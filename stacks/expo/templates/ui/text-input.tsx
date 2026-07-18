// TextInput primitive — labeled input with focus + error states.
import { useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, type TextInputProps as RNTextInputProps, View } from 'react-native';
import { Text } from '@/ui/text';
import { colors } from '@/ui/theme/colors';
import { radii, spacing } from '@/ui/theme/spacing';

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
  const borderColor = error !== undefined ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      {label !== undefined && (
        <Text variant="caption" color="textMuted" style={styles.label}>
          {label}
        </Text>
      )}
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
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  error: { marginLeft: spacing.xs },
});
