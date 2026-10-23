import { ScreenStub } from '@/shell/ScreenStub';

// The UI gallery is mounted here by the orchestrator once @/ui exists.
export default function Screen() {
  return <ScreenStub title="Galeria de UI (dev)" routeName="dev/ui" />;
}
