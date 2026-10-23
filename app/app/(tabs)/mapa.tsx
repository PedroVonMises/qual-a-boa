import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Mapa" routeName="(tabs)/mapa" links={[{ label: 'Casa de exemplo', href: '/casa/exemplo' }]} />;
}
