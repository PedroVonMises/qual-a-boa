import { View } from 'react-native';

import { space } from '@/theme/tokens';
import { Badge, Sheet, Text } from '@/ui';
import type { LegalDoc } from './legalText';

export function LegalSheet({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  return (
    <Sheet visible={!!doc} onClose={onClose} title={doc?.title} testID="legal-sheet">
      <View style={{ gap: space.md }}>
        <Badge label="rascunho" />
        {(doc?.paragraphs ?? []).map((p) => (
          <Text key={p} variant="body" tone="textMuted">
            {p}
          </Text>
        ))}
      </View>
    </Sheet>
  );
}