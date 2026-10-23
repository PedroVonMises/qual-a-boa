import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Explorar" routeName="(tabs)/index" links={[{ label: 'Filtros', href: '/filtros' }, { label: 'Evento de exemplo', href: '/evento/exemplo' }, { label: 'Casa de exemplo', href: '/casa/exemplo' }, { label: 'Acompanhar', href: '/acompanhar' }, { label: 'Ajuda', href: '/ajuda' }]} />;
}
