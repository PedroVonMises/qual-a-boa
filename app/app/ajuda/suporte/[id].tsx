import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  const params = useLocalSearchParams();
  return (
    <ScreenStub
      title="Suporte"
      routeName="ajuda/suporte/[id]"
      params={params}
      links={[{ label: 'Mensagens', href: '/ajuda/mensagens' }]}
    />
  );
}
