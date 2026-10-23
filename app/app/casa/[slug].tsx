import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Casa"
      routeName="casa/[slug]"
      params={params}
      links={[{ label: 'Evento', href: '/evento/exemplo' }, { label: 'Avaliações', href: '/avaliacoes/exemplo' }]}
    />
  );
}
