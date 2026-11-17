import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SAFETY_PROTOCOL_ABOUT, SAFETY_PROTOCOL_COPY, type SafetyProtocol } from '@/domain/safetyProtocol';
import { space } from '@/theme/tokens';
import { Badge, PressableScale, Text } from '@/ui';

/** Selo "Protocolo Não é Não" of a venue (S1). Tapping it explains the state and the law. Nothing without a seal. */
export function SafetyProtocolSeal({ status }: { status?: SafetyProtocol }) {
  const [open, setOpen] = useState(false);
  if (!status) return null;
  const copy = SAFETY_PROTOCOL_COPY[status];
  return (
    <View style={styles.wrap} testID={`selo-nao-e-nao-${status}`}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${copy.label}. ${open ? 'Ocultar detalhes' : 'Ver o que significa'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.badge}>
        <Badge label={copy.label} tone={copy.tone} icon="shield" />
      </PressableScale>
      {open ? (
        <View style={styles.detail} testID="selo-nao-e-nao-detalhe">
          <Text variant="bodySm">{copy.detail}</Text>
          <Text variant="bodySm" tone="textMuted">
            {SAFETY_PROTOCOL_ABOUT}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  badge: { alignSelf: 'flex-start' },
  detail: { gap: space.xs },
});
