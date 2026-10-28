import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  confirmEmailCode,
  isValidCode,
  isValidEmail,
  normalizeCode,
  requestEmailCode,
  type AuthMode,
} from '@/data/auth';
import { syncAll } from '@/data/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Screen, ScreenHeader, Text } from '@/ui';

/** Entrar: email, then the one-time code. Keeps favorites, follows and reviews when upgrading a visitor. */
export function EntrarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: error ? colors.danger : 'transparent' },
  ];

  const sendCode = async () => {
    if (!isValidEmail(email)) return setError('Esse e-mail não parece válido.');
    setBusy(true);
    setError(undefined);
    const res = await requestEmailCode(email);
    setBusy(false);
    if (res.ok) {
      setMode(res.mode);
      setCode('');
    } else setError(res.error);
  };

  const confirm = async () => {
    if (!mode) return;
    if (!isValidCode(code)) return setError('Digite o código de 6 dígitos que enviamos.');
    setBusy(true);
    setError(undefined);
    const res = await confirmEmailCode(email, code, mode);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    void syncAll();
    router.back();
  };

  return (
    <Screen testID="entrar-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Entrar" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode === null ? (
            <>
              <Text variant="bodySm" tone="textMuted">
                Entre para guardar seus salvos, avisos e avaliações e usá-los em outro aparelho. Enviamos um código para o seu e-mail.
              </Text>
              <View style={styles.group}>
                <Text variant="title">E-mail</Text>
                <TextInput
                  testID="entrar-email"
                  accessibilityLabel="E-mail"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  inputMode="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError(undefined);
                  }}
                  onSubmitEditing={sendCode}
                  placeholder="voce@exemplo.com"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />
                {error ? (
                  <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
              </View>
              <Button label="Enviar código" fullWidth loading={busy} onPress={sendCode} testID="entrar-enviar" />
            </>
          ) : (
            <>
              <Text variant="bodySm" tone="textMuted">
                Enviamos um código para {email.trim().toLowerCase()}. Ele vale por alguns minutos.
              </Text>
              <View style={styles.group}>
                <Text variant="title">Código</Text>
                <TextInput
                  testID="entrar-codigo"
                  accessibilityLabel="Código recebido por e-mail"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={10}
                  value={code}
                  onChangeText={(t) => {
                    setCode(normalizeCode(t));
                    setError(undefined);
                  }}
                  onSubmitEditing={confirm}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />
                {error ? (
                  <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
              </View>
              <Button label="Confirmar" fullWidth loading={busy} onPress={confirm} testID="entrar-confirmar" />
              <Button
                label="Usar outro e-mail"
                variant="secondary"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setMode(null);
                  setError(undefined);
                }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { gap: space.xl, paddingBottom: space.xxxl },
  group: { gap: space.sm },
  input: {
    minHeight: hit.min + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
});
