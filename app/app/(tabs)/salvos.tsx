import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Salvos" routeName="(tabs)/salvos" links={[{ label: 'Acompanhar', href: '/acompanhar' }, { label: 'Evento de exemplo', href: '/evento/exemplo' }]} />;
}
