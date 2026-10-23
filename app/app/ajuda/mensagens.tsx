import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Mensagens" routeName="ajuda/mensagens" links={[{ label: 'Conversa de exemplo', href: '/ajuda/suporte/exemplo' }]} />;
}
