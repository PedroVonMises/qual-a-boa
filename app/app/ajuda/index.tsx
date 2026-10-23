import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Ajuda" routeName="ajuda/index" links={[{ label: 'Mensagens', href: '/ajuda/mensagens' }, { label: 'Novo chamado', href: '/ajuda/novo' }]} />;
}
