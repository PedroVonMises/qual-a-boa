import { useLocalSearchParams } from 'expo-router';

import { EventoConversaScreen } from '@/features/comunidade/EventoConversaScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventoConversaScreen id={id} />;
}
