import { useLocalSearchParams } from 'expo-router';

import { TextoScreen } from '@/features/avaliar/TextoScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TextoScreen id={id} />;
}
