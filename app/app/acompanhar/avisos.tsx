import { useLocalSearchParams } from 'expo-router';

import { AvisosScreen } from '@/features/acompanhar/AvisosScreen';

export default function Screen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  return <AvisosScreen eventId={typeof eventId === 'string' ? eventId : undefined} />;
}
