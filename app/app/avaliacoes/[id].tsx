import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Avaliações"
      routeName="avaliacoes/[id]"
      params={params}
      links={[{ label: 'Casa', href: '/casa/exemplo' }]}
    />
  );
}
