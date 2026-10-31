import { FlashList } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import {
  defaultSort,
  KIND_LABEL,
  THREAD_KINDS,
  type CommunitySort,
  type ThreadKind,
  type ThreadQuery,
} from '@/domain/community';
import { formatRelative } from '@/domain/format';
import { ListFrame, StateShell, useGoBack } from '@/features/evento/Frame';
import { space } from '@/theme/tokens';
import { Button, Chip, IconButton, Reveal, REVEAL_MAX_ITEMS, SegmentedControl, Text, ThreadCard, useBreakpoint, useRevealScope } from '@/ui';
import { useThreads } from './hooks';
import { FeedEmpty, FeedFooter } from './ListParts';

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: 'helpful', label: 'Mais úteis' },
  { value: 'recent', label: 'Recentes' },
];

/**
 * Per-event page: threads of one kind at a time, sorted by helpful votes or recency, a page at a time. Sorting and
 * filtering run on the server, so an old event is never cut off by a window over the global feed.
 */
export function EventoConversaScreen({ id }: { id?: string }) {
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const q = useEvent(id);
  const [kind, setKind] = useState<ThreadKind>('vale_a_pena');
  const [sortOverride, setSortOverride] = useState<CommunitySort | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const sort = sortOverride ?? defaultSort(kind);

  const venueSlug = q.data?.venue.slug;
  const query = useMemo<ThreadQuery>(
    // 'none' matches nothing (and is not a server id), so a missing id never falls back to the global feed.
    () => ({ scope: 'all', kind, sort, eventId: id ?? 'none', venueSlug, includeArchived: true }),
    [kind, sort, id, venueSlug],
  );
  const feed = useThreads(query);
  const reveal = useRevealScope();

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data || !id) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Volte e escolha outro evento.' }} />;
  }
  const { event, venue } = q.data;
  const ask = () => router.push(`/comunidade/nova?eventId=${id}&kind=${kind}` as Href);

  return (
    <ListFrame footer={<Button label="Perguntar sobre este evento" fullWidth onPress={ask} />}>
      <FlashList
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
            <View style={styles.title}>
              <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={goBack} />
              <View style={styles.flex}>
                <Text variant="headline" accessibilityRole="header">
                  {event.title}
                </Text>
                <Text variant="bodySm" tone="textMuted">
                  {venue.name} · Conversas
                </Text>
              </View>
            </View>
            <SegmentedControl
              label="Tipo de conversa"
              options={THREAD_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setSortOverride(undefined);
              }}
            />
            <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar conversas" style={styles.chips}>
              {SORTS.map((o) => (
                <Chip key={o.value} label={o.label} selected={sort === o.value} onPress={() => setSortOverride(o.value)} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <FeedEmpty
            feed={feed}
            title="Ainda sem conversas"
            message={`Ninguém perguntou "${KIND_LABEL[kind]}" sobre este evento. Seja o primeiro.`}
            actionLabel="Perguntar"
            onAction={ask}
          />
        }
        ListFooterComponent={<FeedFooter feed={feed} onNew={ask} />}
        onEndReached={feed.fetchNextPage}
        onEndReachedThreshold={0.6}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await feed.refresh();
          setRefreshing(false);
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xxl }}
      />
    </ListFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
