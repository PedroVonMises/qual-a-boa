import { useLocalSearchParams } from 'expo-router';

import { BuscaScreen } from '@/features/busca';

export default function Screen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <BuscaScreen initialQuery={typeof q === 'string' ? q : ''} />;
}
