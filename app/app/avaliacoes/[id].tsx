import { useLocalSearchParams } from 'expo-router';

import { AvaliacoesScreen } from '@/features/avaliacoes/AvaliacoesScreen';

export default function Screen() {
  const { id, enviada } = useLocalSearchParams<{ id: string; enviada?: string }>();
  return <AvaliacoesScreen id={id} sent={enviada === '1'} />;
}
