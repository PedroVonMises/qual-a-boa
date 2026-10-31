import { FlashList } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  KIND_LABEL,
  MAX_FOLLOWED_IN_QUERY,
  THREAD_KINDS,
  type ThreadKind,
  type ThreadQuery,
  type ThreadScope,
} from '@/domain/community';
import { formatRelative } from '@/domain/format';
import { useFollows } from '@/state/follows';
import { maxContentWidth, space } from '@/theme/tokens';
import { Chip, IconButton, Screen, SegmentedControl, TAB_BAR_HEIGHT, Text, ThreadCard, useBreakpoint } from '@/ui';
import { useThreads } from './hooks';
import { FeedEmpty, FeedFooter } from './ListParts';

const SCOPES: { value: ThreadScope; label: string }[] = [
  { value: 'all', label: 'Para você' },
  { value: 'tonight', label: 'Hoje à noite' },
  { value: 'following', label: 'Seguindo' },
];

const EMPTY: Record<ThreadScope, { title: string; message: string }> = {
  all: { title: 'Nada por aqui ainda', message: 'Seja o primeiro a perguntar sobre um evento.' },
  tonight: { title: 'Nada acontecendo agora', message: 'Conversas "Agora" aparecem aqui durante a noite.' },
  following: { title: 'Nenhuma conversa seguida', message: 'Siga um evento para ver as conversas dele aqui.' },
};

/**
 * Comunidade tab: event-scoped threads, newest first, each previewing its "Mais útil" reply. Loads a page at a time
 * (COMMUNITY_PAGE_SIZE) and asks for the next one well before the end, so scrolling never stops.
 */
export function FeedScreen() {
  const router = useRouter();
  const { gutter } = useBreakpoint();
  const follows = useFollows((s) => s.follows);
  const [scope, setScope] = useState<ThreadScope>('all');
  const [kind, setKind] = useState<ThreadKind | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // Oldest follows first, so the cap in the request drops the newest rather than reshuffling on every follow.
  const followedEventIds = useMemo(
    () =>
      Object.values(follows)
        .sort((a, b) => (a.followedAt < b.followedAt ? -1 : 1))
        .slice(0, MAX_FOLLOWED_IN_QUERY)
        .map((f) => f.eventId),
    [follows],
  );
  const query = useMemo<ThreadQuery>(
    () => ({ scope, kind, sort: 'recent', followedEventIds: scope === 'following' ? followedEventIds : undefined }),
    [scope, kind, followedEventIds],
  );
  const feed = useThreads(query);
  const goNew = () => router.push('/comunidade/nova' as Href);

  return (
    <Screen bleed testID="comunidade-screen">
      <View style={styles.inner}>
        <FlashList
          testID="comunidade-list"
          data={feed.items}
          keyExtractor={(t) => t.id}
          renderItem={({ item: t }) => (
            <ThreadCard
              eventName={t.eventName}
              kind={t.kind}
              title={t.title}
              topComment={t.top}
              replies={t.replies}
              ago={formatRelative(t.createdAt)}
              onPress={() => router.push(`/comunidade/t/${t.id}` as Href)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.head}>
                <Text variant="display" accessibilityRole="header">
                  Comunidade
                </Text>
                <IconButton icon="plus" label="Nova conversa" variant="filled" onPress={goNew} />
              </View>
              <SegmentedControl label="Mostrar" options={SCOPES} value={scope} onChange={setScope} />
              <View accessibilityRole="radiogroup" accessibilityLabel="Tipo de conversa" style={styles.chips}>
                <Chip label="Tudo" selected={!kind} onPress={() => setKind(undefined)} />
                {THREAD_KINDS.map((k) => (
                  <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <FeedEmpty
              feed={feed}
              title={EMPTY[scope].title}
              message={EMPTY[scope].message}
              actionLabel="Nova conversa"
              onAction={goNew}
            />
          }
          ListFooterComponent={<FeedFooter feed={feed} onNew={goNew} />}
          onEndReached={feed.fetchNextPage}
          onEndReachedThreshold={0.6}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await feed.refresh();
            setRefreshing(false);
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: TAB_BAR_HEIGHT + space.xxxl }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
