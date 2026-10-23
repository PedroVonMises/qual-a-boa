import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ShelfProps<T> {
  title: string;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor?: (item: T, index: number) => string;
  /** Optional "ver todos" action next to the title. */
  actionLabel?: string;
  onAction?: () => void;
  /** Horizontal inset of the first/last card (screen gutter). */
  gutter?: number;
  style?: StyleProp<ViewStyle>;
}

/** Titled horizontal shelf of cards. */
export function Shelf<T>({ title, data, renderItem, keyExtractor, actionLabel, onAction, gutter = space.lg, style }: ShelfProps<T>) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {actionLabel && onAction ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.action}>
            <Text variant="bodySm" tone="textMuted">
              {actionLabel}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <FlashList
        horizontal
        data={data as T[]}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={{ paddingHorizontal: gutter }}
      />
    </View>
  );
}

function Gap() {
  return <View style={{ width: space.md }} />;
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
});
