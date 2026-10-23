import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Novo chamado" routeName="ajuda/novo" links={[{ label: 'Ajuda', href: '/ajuda' }]} />;
}
