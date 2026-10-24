import { StyleSheet, View } from 'react-native';

import type { SearchItem } from '@/domain/types';
import { space } from '@/theme/tokens';
import { PressableScale, Text } from '@/ui';
import { ItemCard } from './ItemCard';

const CARD_W = 264;
const CARD_H = 240;

/** Web layout: one lead card spanning 2 columns x 2 rows, smaller cards beside it. */
export function LeadGrid({ title, items, onAction, reasons }: { title: string; items: SearchItem[]; onAction: () => void; reasons?: Record<string, string> }) {
  const [lead, ...rest] = items;
  return (
    <View testID="lead-grid" style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel="ver todos" onPress={onAction} style={styles.action}>
          <Text variant="bodySm" tone="textMuted">
            ver todos
          </Text>
        </PressableScale>
      </View>
      <View style={styles.row}>
        <ItemCard item={lead} reason={reasons?.[lead.event.id]} style={styles.lead} />
        <View style={styles.small}>
          {rest.slice(0, 4).map((i) => (
            <ItemCard key={i.event.id} item={i} reason={reasons?.[i.event.id]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  lead: { width: CARD_W * 2 + space.md, height: CARD_H * 2 + space.md },
  small: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, width: CARD_W * 2 + space.md },
});
