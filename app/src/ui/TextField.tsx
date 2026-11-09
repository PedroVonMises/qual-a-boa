import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space, type } from '@/theme/tokens';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'accessibilityLabel'> {
  /** Visible label above the field; also its accessible name. */
  label: string;
  /** Error message: danger border + text announced politely. */
  error?: string;
  /** Helper text under the field (hidden while there is an error). */
  hint?: string;
  /** Geist Mono for numbers (CEP, phone). */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Labelled 48px text input on Raised Ash: hairline border, accent on focus, danger on error. Grows with the font scale. */
export function TextField({ label, error, hint, mono, style, testID, editable = true, onFocus, onBlur, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;
  return (
    <View style={[styles.wrap, style]}>
      <Text variant="bodySm" tone="textMuted">
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ? undefined : hint}
        accessibilityState={{ disabled: !editable }}
        aria-invalid={error ? true : undefined}
        editable={editable}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...input}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            color: editable ? colors.text : colors.textMuted,
            fontFamily: mono ? fonts.mono : fonts.body,
          },
        ]}
      />
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite" testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  // minHeight (not height) so 200% font scale grows the field instead of clipping the text.
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    fontSize: type.body.fontSize,
  },
});
