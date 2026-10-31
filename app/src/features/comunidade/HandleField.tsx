import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useCommunity } from '@/state/community';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Text } from '@/ui';

/** Inline first-post prompt: choose a lowercase @handle (kept on this device until accounts sync). */
export function HandleField() {
  const { colors } = useTheme();
  const claimHandle = useCommunity((s) => s.claimHandle);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(await claimHandle(value));
    setBusy(false);
  };
  return (
    <View style={styles.wrap}>
      <Text variant="bodySm" tone="textMuted">
        Escolha seu @ para postar com nome, ou poste como anônimo.
      </Text>
      <View style={styles.row}>
        <TextInput
          testID="comunidade-handle"
          value={value}
          onChangeText={(t) => {
            setValue(t.toLowerCase());
            if (error) setError(undefined);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          accessibilityLabel="Seu @"
          placeholder="@seunome"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: error ? colors.danger : colors.border },
          ]}
        />
        <Button label="Salvar" variant="secondary" loading={busy} onPress={save} testID="comunidade-handle-salvar" />
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: hit.button,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
});
