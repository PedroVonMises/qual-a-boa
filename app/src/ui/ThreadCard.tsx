import { StyleSheet, View } from 'react-native';

import type { ThreadKind } from '@/domain/community';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { HelpfulBadge } from './HelpfulBadge';
import { Icon } from './Icon';
import { KindChip } from './KindChip';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ThreadCardProps {
  eventName: string;
  kind: ThreadKind;
  title: string;
  /** Pinned "Mais útil" preview; omit when no comment reached the threshold. */
  topComment?: { body: string; votes: number };
  replies: number;
  ago: string;
  onPress: () => void;
  testID?: string;
}

/** Feed row: event · kind, title, optional Mais útil preview, reply count. Whole row is one 44px+ target. */
export function ThreadCard({ eventName, kind, title, topComment, replies, ago, onPress, testID }: ThreadCardProps) {
  const { colors } = useTheme();
  const repliesLabel = `${replies} ${replies === 1 ? 'resposta' : 'respostas'}`;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${eventName}. ${repliesLabel}`}
      onPress={onPress}
      scaleTo={0.99}
      style={[styles.card, { borderTopColor: colors.border }]}>
      <View style={styles.meta}>
        <Text variant="bodySm" numberOfLines={1} style={styles.event}>
          {eventName}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          ·
        </Text>
        <KindChip kind={kind} />
      </View>
      <Text variant="title">{title}</Text>
      {topComment ? (
        <View style={[styles.top, { backgroundColor: colors.surface }]}>
          <HelpfulBadge votes={topComment.votes} />
          <Text variant="bodySm" numberOfLines={3}>
            {topComment.body}
          </Text>
        </View>
      ) : null}
      <View style={styles.footer}>
        <Icon name="message" size={18} color="textMuted" />
        <Text variant="bodySm" tone="textMuted">
          {repliesLabel}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {ago}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm, minHeight: 44 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  event: { fontWeight: '600', flexShrink: 1 },
  top: { padding: space.md, borderRadius: radius.sm, gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
