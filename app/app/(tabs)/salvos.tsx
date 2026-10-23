import { Text, View } from 'react-native';

import { palette } from '@/theme/tokens';

export default function SalvosScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.night }}>
      <Text style={{ color: palette.bone, fontSize: 24 }}>Salvos</Text>
    </View>
  );
}
