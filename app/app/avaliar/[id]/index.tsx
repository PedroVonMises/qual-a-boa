import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Avaliar"
      routeName="avaliar/[id]/index"
      params={params}
      links={[{ label: 'Escrever avaliação', href: '/avaliar/exemplo/texto' }]}
    />
  );
}
