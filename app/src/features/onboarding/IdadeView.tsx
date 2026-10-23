import { useRouter } from 'expo-router';
import { useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import { useSession } from '@/state/session';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space } from '@/theme/tokens';
import { Button, Logo, Screen, Text } from '@/ui';
import { NARROW_MAX_WIDTH } from '../layout';

/** Age gate (canvas Idade). */
export function IdadeView() {
  const router = useRouter();
  const { colors } = useTheme();
  const confirmAge = useSession((s) => s.confirmAge);
  const [blocked, setBlocked] = useState(false);
  const [closeHint, setCloseHint] = useState(false);

  const close = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
    else setCloseHint(true);
  };

  return (
    <Screen edges={['top', 'bottom']} testID="idade-screen">
      <View style={styles.column}>
        <View style={styles.hero} testID="idade-hero">
          <Logo variant="neon" size={96} />
        </View>
        <View style={styles.copy}>
          <Text variant="display" accessibilityRole="header">
            Só para maiores de <Text variant="display" tone="accent">18 anos</Text>
          </Text>
          {blocked ? (
            <View accessibilityRole="alert" style={[styles.blocked, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
              <Text variant="body" tone="dangerText">
                Você precisa ter 18 anos ou mais para usar o app
              </Text>
              {closeHint ? (
                <Text variant="bodySm" tone="textMuted">
                  Você já pode fechar esta janela. Volte quando fizer 18 anos.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text variant="body" tone="textMuted">
              Aqui você acha festas e casas noturnas de Vitória. Confirme sua idade para continuar.
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {blocked ? (
            <Button label="Fechar o app" variant="secondary" fullWidth onPress={close} />
          ) : (
            <>
              <Button
                label="Tenho 18 anos ou mais"
                fullWidth
                onPress={() => {
                  confirmAge();
                  router.replace('/onboarding/local');
                }}
              />
              <Button label="Sou menor de idade" variant="secondary" fullWidth onPress={() => setBlocked(true)} />
            </>
          )}
          <Text variant="bodySm" tone="textMuted" style={styles.note}>
            Beba com moderação. Se beber, não dirija.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', justifyContent: 'space-between', gap: space.xxl, paddingVertical: space.xxl },
  hero: { height: 220, borderRadius: radius.lg, backgroundColor: palette.wine, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: space.md },
  blocked: { gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1 },
  actions: { gap: space.md },
  note: { textAlign: 'center' },
});