import { useLocalSearchParams } from 'expo-router';

import { AvaliarScreen } from '@/features/avaliar/AvaliarScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AvaliarScreen id={id} />;
}
