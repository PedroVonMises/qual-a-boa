import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Evento"
      routeName="evento/[id]"
      params={params}
      links={[{ label: 'Casa', href: '/casa/exemplo' }, { label: 'Artista', href: '/artista/exemplo' }, { label: 'Ao vivo', href: '/ao-vivo/exemplo' }, { label: 'Avaliar', href: '/avaliar/exemplo' }]}
    />
  );
}
