import { useLocalSearchParams } from 'expo-router';

import { ThreadScreen } from '@/features/comunidade/ThreadScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThreadScreen id={id} />;
}
