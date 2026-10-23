import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Ao vivo"
      routeName="ao-vivo/[id]"
      params={params}
      links={[{ label: 'Evento', href: '/evento/exemplo' }, { label: 'Avaliar', href: '/avaliar/exemplo' }]}
    />
  );
}
