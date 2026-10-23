import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/state/session';
import { fonts, palette, space, type } from '@/theme/tokens';

import { BrandBulb } from './BrandBulb';
import { ShellButton } from './ShellButton';

/** Age gate (canvas N1). Visual body to be rebuilt with the ui kit. */
export function IdadeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirmAge = useSession((s) => s.confirmAge);
  const [underage, setUnderage] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <BrandBulb size={64} />
        <Text accessibilityRole="header" style={styles.title}>
          Só para maiores de <Text style={{ color: palette.riotPink }}>18 anos</Text>
        </Text>
        <Text style={styles.body}>
          {underage
            ? 'Que pena. O Qual a boa? é só para maiores de 18 anos. Volte quando fizer 18.'
            : 'Aqui você acha festas e casas noturnas de Vitória. Confirme sua idade para continuar.'}
        </Text>
      </View>
      <View style={styles.actions}>
        <ShellButton
          label="Tenho 18 anos ou mais"
          onPress={() => {
            confirmAge();
            router.replace('/onboarding/local');
          }}
        />
        <ShellButton label="Sou menor de idade" variant="secondary" onPress={() => setUnderage(true)} />
        <Text style={styles.note}>Beba com moderação. Se beber, não dirija.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night, paddingHorizontal: space.xxl, justifyContent: 'space-between' },
  top: { gap: 14, maxWidth: 420 },
  title: { color: palette.bone, fontFamily: fonts.display, fontSize: 36, lineHeight: 38 },
  body: { color: palette.dusk, fontFamily: fonts.body, ...type.body },
  actions: { gap: space.md, maxWidth: 480, width: '100%' },
  note: { color: palette.dusk, fontFamily: fonts.body, ...type.bodySm, marginTop: space.xs },
});
