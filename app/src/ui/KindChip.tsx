import { Text } from './Text';
import { KIND_LABEL, type ThreadKind } from '@/domain/community';

const TONE: Record<ThreadKind, string> = {
  vale_a_pena: 'accent',
  grupo: 'text',
  agora: 'success',
};

/** Non-interactive uppercase label for a thread kind. Always text, never color alone. */
export function KindChip({ kind }: { kind: ThreadKind }) {
  return (
    <Text variant="caption" tone={TONE[kind]} style={{ fontWeight: '600', letterSpacing: 0.3 }}>
      {KIND_LABEL[kind].toUpperCase()}
    </Text>
  );
}
