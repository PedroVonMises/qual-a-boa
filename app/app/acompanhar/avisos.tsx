import { ScreenStub } from '@/shell/ScreenStub';

export default function Screen() {
  return <ScreenStub title="Avisos" routeName="acompanhar/avisos" links={[{ label: 'Acompanhar', href: '/acompanhar' }]} />;
}
