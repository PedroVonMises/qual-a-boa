import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/state/session';
import { fonts, hit, palette, radius, space, type } from '@/theme/tokens';

import { ShellButton } from './ShellButton';

const STYLES = ['Pagode', 'Funk', 'Eletrônica', 'Rock', 'Sertanejo', 'Pop'];

/** Location and styles onboarding (canvas N2). Visual body to be rebuilt with the ui kit. */
export function LocalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finishOnboarding = useSession((s) => s.finishOnboarding);
  const [picked, setPicked] = useState<string[]>([]);

  // TODO(orchestrator): "Usar minha localização" requests permission through @/state/location,
  // "Escolher o bairro" opens the neighborhood picker, and styles go to @/state/filters.
  const done = () => {
    finishOnboarding();
    router.replace('/');
  };
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.replace('/onboarding/idade')} style={styles.back}>
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.step}>2 de 2</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          O que rola <Text style={{ color: palette.riotPink }}>perto de você</Text>
        </Text>
        <Text style={styles.body}>
          Usamos sua localização só para ordenar as casas por distância. Você pode mudar isso depois.
        </Text>
        <Text style={styles.label}>
          Seus estilos <Text style={{ fontFamily: fonts.body }}>(opcional)</Text>
        </Text>
        <View style={styles.chips}>
          {STYLES.map((s) => {
            const on = picked.includes(s);
            return (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => toggle(s)}
                style={[styles.chip, { backgroundColor: on ? palette.riotPink : palette.ash }]}>
                <Text style={[styles.chipText, { color: on ? palette.riotInk : palette.bone }]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.actions}>
        <ShellButton label="Usar minha localização" onPress={done} />
        <ShellButton label="Escolher o bairro" variant="secondary" onPress={done} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night, paddingHorizontal: space.xxl, justifyContent: 'space-between' },
  top: { gap: 14, maxWidth: 480 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: hit.min, height: hit.min, borderRadius: radius.full, backgroundColor: palette.ash, alignItems: 'center', justifyContent: 'center' },
  backText: { color: palette.bone, fontSize: 26, lineHeight: 28 },
  step: { color: palette.dusk, fontFamily: fonts.mono, ...type.bodySm },
  title: { color: palette.bone, fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  body: { color: palette.dusk, fontFamily: fonts.body, ...type.body },
  label: { color: palette.dusk, fontFamily: fonts.bodySemi, ...type.bodySm, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: hit.chip, paddingHorizontal: space.lg, borderRadius: radius.full, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, ...type.bodySm },
  actions: { gap: space.md, maxWidth: 480, width: '100%' },
});
