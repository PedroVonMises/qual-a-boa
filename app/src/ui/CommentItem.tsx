import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';
import { HelpfulBadge } from './HelpfulBadge';
import { HelpfulButton } from './HelpfulButton';
import { Text } from './Text';

export interface CommentItemProps {
  handle?: string;
  avatarHue?: number;
  anonymous?: boolean;
  ago: string;
  body: string;
  helpfulCount: number;
  helpful: boolean;
  /** Pinned "Mais útil" treatment. */
  top?: boolean;
  /** 0 = top level, 1 = reply (indented, no further nesting). */
  depth?: 0 | 1;
  onToggleHelpful: () => void;
  /** Omitted at depth 1 (nesting is capped). */
  onReply?: () => void;
  /** Omit for your own comments. */
  onReport?: () => void;
  reported?: boolean;
  testID?: string;
}

export function CommentItem({
  handle,
  avatarHue,
  anonymous = false,
  ago,
  body,
  helpfulCount,
  helpful,
  top = false,
  depth = 0,
  onToggleHelpful,
  onReply,
  onReport,
  reported = false,
  testID,
}: CommentItemProps) {
  const { colors } = useTheme();
  const name = anonymous || !handle ? 'Anônimo' : `@${handle}`;
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        depth === 1 && [styles.reply, { borderLeftColor: colors.border }],
        top && [styles.top, { backgroundColor: colors.surface }],
      ]}>
      {top ? <HelpfulBadge /> : null}
      <View style={styles.head}>
        <Avatar handle={handle} hue={avatarHue} anonymous={anonymous} />
        <Text variant="bodySm" style={styles.name}>
          {name}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {ago}
        </Text>
      </View>
      <Text variant="body">{body}</Text>
      <View style={styles.actions}>
        <HelpfulButton count={helpfulCount} selected={helpful} onPress={onToggleHelpful} />
        {onReply && depth === 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Responder"
            onPress={onReply}
            scaleTo={0.97}
            style={styles.replyBtn}>
            <Text variant="bodySm" tone="textMuted" style={styles.name}>
              Responder
            </Text>
          </PressableScale>
        ) : null}
        {onReport ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={reported ? 'Denunciado' : 'Denunciar'}
            accessibilityState={{ disabled: reported }}
            disabled={reported}
            onPress={onReport}
            scaleTo={0.97}
            style={styles.replyBtn}>
            <Text variant="bodySm" tone="textMuted">
              {reported ? 'Denunciado' : 'Denunciar'}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingVertical: space.sm },
  reply: { marginLeft: 28, paddingLeft: space.md, borderLeftWidth: 2 },
  top: { padding: space.lg, borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontWeight: '600' },
  replyBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: space.sm, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
