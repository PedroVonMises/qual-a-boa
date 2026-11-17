import { useLocalSearchParams } from 'expo-router';

import { RelatoScreen } from '@/features/seguranca';

export default function Screen() {
  const { casa, evento } = useLocalSearchParams<{ casa?: string; evento?: string }>();
  return <RelatoScreen slug={casa} eventId={evento} />;
}
