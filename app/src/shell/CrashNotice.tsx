import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearCrash, readCrash, type CrashRecord } from '@/lib/crashReport';
import { env } from '@/lib/env';
import { fonts, hit, palette, radius, space } from '@/theme/tokens';

/** Shows the error that closed the previous session (non-production builds only, never leaking stack traces in prod). */
export function CrashNotice() {
  const [crash, setCrash] = useState<CrashRecord | null>(null);
  useEffect(() => {
    void readCrash().then(setCrash);
  }, []);
  if (!crash) return null;
  const close = () => {
    setCrash(null);
    void clearCrash();
  };
  return (
    <View style={styles.root} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          O app precisou reiniciar
        </Text>
        <Text style={styles.msg}>
          Encontramos uma falha na sessão anterior. Já voltamos ao normal — você pode continuar navegando.
        </Text>
        {env.demoTools ? (
          <Text style={styles.meta}>
            Diagnóstico: {crash.at} · {crash.message}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={close} style={styles.btn}>
          <Text style={styles.btnText}>Continuar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * Fallback UI for render errors caught by the root error boundary (expo-router `ErrorBoundary` export).
 * Never exposes raw JavaScript stack traces to users.
 */
export function ErrorScreen({ error: _error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.root} testID="error-boundary-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Ops! Algo deu errado por aqui
        </Text>
        <Text style={styles.msg}>
          Não conseguimos carregar esta tela agora. Tente novamente em instantes.
        </Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.btn}>
          <Text style={styles.btnText}>Tentar de novo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.night, zIndex: 1000 },
  body: { padding: space.xxl, paddingTop: 64, gap: space.md, maxWidth: 520, alignSelf: 'center', width: '100%' },
  title: { color: palette.bone, fontFamily: fonts.bodyMedium, fontSize: 22 },
  meta: { color: palette.dusk, fontSize: 13 },
  msg: { color: palette.bone, fontSize: 15, lineHeight: 22 },
  btn: { minHeight: hit.min, borderRadius: radius.md, backgroundColor: palette.riotPink, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  btnText: { color: palette.riotInk, fontFamily: fonts.bodyMedium, fontSize: 16 },
});
