import { useLocalSearchParams } from 'expo-router';

import { IngressosScreen } from '@/features/ingressos/IngressosScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IngressosScreen id={id} />;
}
