import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { palette } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Não encontrado' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: palette.night }}>
        <Text style={{ color: palette.bone, fontSize: 20, fontWeight: '600' }}>Essa tela não existe.</Text>
        <Link href="/" style={{ marginTop: 16, paddingVertical: 12 }}>
          <Text style={{ color: palette.riotPink, fontSize: 16 }}>Voltar para o início</Text>
        </Link>
      </View>
    </>
  );
}
