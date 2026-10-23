import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Perfil" routeName="(tabs)/perfil" links={[{ label: 'Ajuda', href: '/ajuda' }, { label: 'Acompanhar', href: '/acompanhar' }]} />;
}
