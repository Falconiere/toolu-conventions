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
 * Every input reads like a spec line: label above in mono caps, control on the
 * band with a hairline border and a 4pt radius, note below in mono. Nothing
 * floats, nothing animates its label, and the focus border is the only colour a
 * field ever earns. Composes the Text primitive so typography stays consistent.
 */
export function TextInput({ label, error, style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  // Error outranks focus: a field that is both wrong and focused is still wrong.
  const borderColor = error !== undefined ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={styles.container}>
      {/* `textSoft`, not `textFaint`: a field label carries an instruction, and
          the language moves those up one step of ink. `textFaint` is a metadata
          ink — 2.5:1 on the dark band, 1.9:1 on the light one. */}
      {label !== undefined && (
        <Text variant="label" color="textSoft">
          {label}
        </Text>
      )}
      {/* Focus is a 1pt signal border PLUS a 3pt wash ring; the ring is always
          laid out (transparent when idle) so focusing never shifts the layout. */}
      <View style={[styles.ring, { borderColor: focused ? colors.focusRing : 'transparent' }]}>
        <RNTextInput
          placeholderTextColor={colors.textSoft}
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
      {/* The label never changes colour on error — only the border and this note,
          so the field's identity stays readable while it is being corrected. */}
      {error !== undefined && (
        <Text variant="meta" color="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  ring: {
    borderWidth: layout.focusRing,
    borderRadius: radii.sm + layout.focusRing,
  },
  input: {
    minHeight: layout.minTouchTarget,
    borderWidth: borderWidth.hairline,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    // The field is RECESSED into its panel, not raised off it.
    backgroundColor: colors.surfaceInset,
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
  },
});
