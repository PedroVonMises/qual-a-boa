import { Text, View } from 'react-native';

import { palette } from '@/theme/tokens';

export default function ExplorarScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.night }}>
      <Text style={{ color: palette.bone, fontSize: 24 }}>Explorar</Text>
    </View>
  );
}
