import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Filtros" routeName="filtros" links={[{ label: 'Voltar para Explorar', href: '/' }]} />;
}
