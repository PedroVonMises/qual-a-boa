import { useLocalSearchParams } from 'expo-router';

import { AoVivoScreen } from '@/features/aoVivo/AoVivoScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AoVivoScreen id={typeof id === 'string' ? id : undefined} />;
}
