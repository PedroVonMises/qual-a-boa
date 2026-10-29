import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, type } from '@/theme/tokens';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Accessible name; defaults to "Buscar". */
  label?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  /** Focus the field on mount (dedicated search screen). */
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 48px search field on Raised Ash. The label lives in the placeholder AND the accessible label. */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar',
  label = 'Buscar',
  onSubmit,
  onClear,
  autoFocus,
  style,
  testID,
}: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: colors.surfaceAlt }, style]}>
      <Icon name="search" size={20} color="textMuted" />
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        style={[styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <IconButton
          icon="close"
          label="Limpar busca"
          size={18}
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 2,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, minHeight: 48, fontFamily: fonts.body, fontSize: type.body.fontSize },
});
