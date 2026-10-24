import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearCrash, readCrash, type CrashRecord } from '@/lib/crashReport';
import { fonts, hit, palette, radius, space } from '@/theme/tokens';

/** Shows the error that closed the previous session, so it can be screenshotted and reported. */
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
          O app fechou com um erro
        </Text>
        <Text style={styles.meta}>
          {crash.at} · {crash.fatal ? 'fatal' : 'não fatal'}
        </Text>
        <Text selectable style={styles.msg}>
          {crash.message}
        </Text>
        {crash.stack ? (
          <Text selectable style={styles.stack}>
            {crash.stack}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={close} style={styles.btn}>
          <Text style={styles.btnText}>Fechar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Fallback UI for render errors caught by the root error boundary (expo-router `ErrorBoundary` export). */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Algo deu errado
        </Text>
        <Text selectable style={styles.msg}>
          {String(error?.message ?? error)}
        </Text>
        {error?.stack ? (
          <Text selectable style={styles.stack}>
            {error.stack.slice(0, 2500)}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={retry} style={styles.btn}>
          <Text style={styles.btnText}>Tentar de novo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.night, zIndex: 1000 },
  body: { padding: space.xxl, paddingTop: 64, gap: space.md },
  title: { color: palette.bone, fontFamily: fonts.bodyMedium, fontSize: 22 },
  meta: { color: palette.dusk, fontSize: 13 },
  msg: { color: palette.bone, fontSize: 15 },
  stack: { color: palette.dusk, fontSize: 11 },
  btn: { minHeight: hit.min, borderRadius: radius.md, backgroundColor: palette.riotPink, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  btnText: { color: palette.riotInk, fontFamily: fonts.bodyMedium, fontSize: 16 },
});
