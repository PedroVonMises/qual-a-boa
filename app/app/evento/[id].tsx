import { useLocalSearchParams } from 'expo-router';

import { EventoScreen } from '@/features/evento/EventoScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventoScreen id={id} />;
}
