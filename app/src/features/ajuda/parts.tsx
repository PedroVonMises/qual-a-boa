import { StyleSheet, View } from 'react-native';

import type { TicketStatus } from '@/domain/engage';
import { RESPONSE_DAYS } from '@/state/support';
import { space } from '@/theme/tokens';
import { Badge, Icon, Text } from '@/ui';
import { STATUS_ICON, STATUS_LABEL } from './tickets';

/** Expected response time. Honest: there is no live chat, only a written reply. */
export function ResponseTime() {
  return (
    <View style={styles.row}>
      <Icon name="clock" size={16} color="textMuted" />
      <Text variant="bodySm" tone="textMuted" style={styles.flex}>
        Resposta em até {RESPONSE_DAYS} dias úteis.
      </Text>
    </View>
  );
}

/** Status is spelled out in text; color only reinforces it. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === 'answered' ? 'success' : status === 'open' ? 'accent' : 'neutral';
  return <Badge label={STATUS_LABEL[status]} icon={STATUS_ICON[status]} tone={tone} />;
}

/** Screenshot attach needs expo-image-picker, which is not installed yet. */
export function AttachSoon({ label = 'Anexar print' }: { label?: string }) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label}, em breve`}
      style={[styles.attach, styles.disabled]}>
      <Icon name="paperclip" size={20} color="textMuted" />
      <Text variant="bodySm" tone="textMuted">
        {label} (em breve)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  attach: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  disabled: { opacity: 0.6 },
});
