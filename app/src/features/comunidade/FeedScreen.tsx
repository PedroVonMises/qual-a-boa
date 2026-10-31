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
import { ufName } from '@/domain/region';
import { useFollows } from '@/state/follows';
import { useRegion } from '@/state/region';
import { maxContentWidth, space } from '@/theme/tokens';
import { Chip, IconButton, Reveal, REVEAL_MAX_ITEMS, Screen, SegmentedControl, TAB_BAR_HEIGHT, Text, ThreadCard, useBreakpoint, useRevealScope } from '@/ui';
import { useThreads } from './hooks';
import { FeedEmpty, FeedFooter } from './ListParts';
import { StatePill } from './StatePill';
import { StateSheet } from './StateSheet';

const SCOPES: { value: ThreadScope; label: string }[] = [
  { value: 'all', label: 'Para você' },
  { value: 'tonight', label: 'Hoje à noite' },
  { value: 'following', label: 'Seguindo' },
];

const emptyCopy = (state: string): Record<ThreadScope, { title: string; message: string }> => ({
  all: { title: 'Nada por aqui ainda', message: `Seja o primeiro a puxar assunto em ${state}.` },
  tonight: { title: 'Nada acontecendo agora', message: `Conversas "Agora" de ${state} aparecem aqui durante a noite.` },
  following: { title: 'Nenhuma conversa seguida', message: 'Siga um evento para ver as conversas dele aqui.' },
});

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
  const [stateOpen, setStateOpen] = useState(false);
  const uf = useRegion((s) => s.uf);
  const stateName = ufName(uf);
  const empty = emptyCopy(stateName)[scope];

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
    () => ({ scope, kind, uf, sort: 'recent', followedEventIds: scope === 'following' ? followedEventIds : undefined }),
    [scope, kind, uf, followedEventIds],
  );
  const feed = useThreads(query);
  const reveal = useRevealScope();
  const goNew = () => router.push('/comunidade/nova' as Href);

  return (
    <Screen bleed testID="comunidade-screen">
      <View style={styles.inner}>
        <FlashList
          testID="comunidade-list"
          data={feed.items}
          keyExtractor={(t) => t.id}
          renderItem={({ item: t, index }) => (
            <Reveal index={index} scope={reveal} id={t.id} disabled={index >= REVEAL_MAX_ITEMS}>
              <ThreadCard
                eventName={t.eventName}
                kind={t.kind}
                title={t.title}
                topComment={t.top}
                replies={t.replies}
                ago={formatRelative(t.createdAt)}
                onPress={() => router.push(`/comunidade/t/${t.id}` as Href)}
              />
            </Reveal>
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.head}>
                <View style={styles.titles}>
                  <Text variant="display" accessibilityRole="header">
                    Comunidade
                  </Text>
                  <Text variant="bodySm" tone="textMuted">
                    Conversas de quem está no seu estado.
                  </Text>
                </View>
                <IconButton icon="plus" label="Nova conversa" variant="filled" onPress={goNew} />
              </View>
              <StatePill onPress={() => setStateOpen(true)} />
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
              title={empty.title}
              message={empty.message}
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
      <StateSheet visible={stateOpen} onClose={() => setStateOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titles: { flex: 1, gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
