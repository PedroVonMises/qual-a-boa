import { useLocalSearchParams } from 'expo-router';

import { VoltaScreen } from '@/features/volta';

export default function Screen() {
  const { evento } = useLocalSearchParams<{ evento?: string }>();
  return <VoltaScreen eventId={evento} />;
}
