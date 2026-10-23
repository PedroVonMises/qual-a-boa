import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Avaliar (texto)"
      routeName="avaliar/[id]/texto"
      params={params}
      links={[{ label: 'Ver avaliações', href: '/avaliacoes/exemplo' }]}
    />
  );
}
