import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import type { EventChange } from '@/domain/engage';
import { formatRelative } from '@/domain/format';
import { useFollows } from '@/state/follows';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Button, PressableScale, Text } from '@/ui';
import { CHANGE_KIND_LABEL } from './logic';

function ChangeRow({ change, nowMs }: { change: EventChange; nowMs: number }) {
  const { colors } = useTheme();
  const markRead = useFollows((s) => s.markRead);
  const title = useEvent(change.eventId).data?.event.title;
  const when = formatRelative(change.at, nowMs);
  const meta = [title, CHANGE_KIND_LABEL[change.kind]].filter(Boolean).join(' · ');
  return (
    <PressableScale
      testID={`change-${change.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${change.read ? 'Lida' : 'Não lida'}. ${change.text}. ${meta}. ${when}`}
      accessibilityHint={change.read ? undefined : 'Marca como lida'}
      onPress={() => markRead(change.id)}
      scaleTo={0.99}
      style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.flag}>
        {change.read ? null : (
          <>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text variant="caption" tone="accent" style={styles.bold}>
              Nova
            </Text>
          </>
        )}
      </View>
      <View style={styles.body}>
        <Text variant="body" style={change.read ? undefined : styles.bold}>
          {change.text}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {meta}
        </Text>
      </View>
      <Text variant="mono" tone="textMuted">
        {when}
      </Text>
    </PressableScale>
  );
}

/** Newest-first change feed with unread markers (dot + the word "Nova"). */
export function ChangeFeed({ changes, nowMs }: { changes: EventChange[]; nowMs: number }) {
  const markAllRead = useFollows((s) => s.markAllRead);
  const unread = changes.filter((c) => !c.read).length;
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text variant="title" accessibilityRole="header" style={styles.flex}>
          Novidades
        </Text>
        {unread > 0 ? <Button label="Marcar como lidas" variant="ghost" onPress={() => markAllRead()} /> : null}
      </View>
      <Text accessibilityLiveRegion="polite" variant="bodySm" tone="textMuted">
        {changes.length === 0 ? 'Nenhuma novidade por enquanto.' : unread === 0 ? 'Tudo lido.' : `${unread} ${unread === 1 ? 'não lida' : 'não lidas'}`}
      </Text>
      {changes.map((c) => (
        <ChangeRow key={c.id} change={c} nowMs={nowMs} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1 },
  flag: { width: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
});
