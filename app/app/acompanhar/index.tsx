import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Acompanhar" routeName="acompanhar/index" links={[{ label: 'Avisos', href: '/acompanhar/avisos' }, { label: 'Ao vivo', href: '/ao-vivo/exemplo' }]} />;
}
