import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { defaultSort, KIND_LABEL, sortComments, THREAD_KINDS, type CommunitySort, type ThreadKind } from '@/domain/community';
import { formatRelative } from '@/domain/format';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { space } from '@/theme/tokens';
import { Button, Chip, EmptyState, IconButton, SegmentedControl, Text, ThreadCard, useBreakpoint } from '@/ui';
import { threadsForEvent, useThreads } from './hooks';

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: 'helpful', label: 'Mais úteis' },
  { value: 'recent', label: 'Recentes' },
];

/** Per-event hub: threads grouped by kind, sortable by helpful votes or recency. */
export function EventoConversaScreen({ id }: { id?: string }) {
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const q = useEvent(id);
  const all = useThreads();
  const [kind, setKind] = useState<ThreadKind>('vale_a_pena');
  const [sortOverride, setSortOverride] = useState<CommunitySort | undefined>();
  const sort = sortOverride ?? defaultSort(kind);

  const venueSlug = q.data?.venue.slug;
  const list = useMemo(() => {
    if (!id) return [];
    const ofKind = threadsForEvent(all, id, venueSlug).filter((t) => t.kind === kind);
    // Threads rank by their pinned reply's votes first, so the most useful discussions surface.
    return sortComments(
      ofKind.map((t) => ({ ...t, helpfulCount: t.top?.votes ?? 0 })),
      sort,
    );
  }, [all, id, venueSlug, kind, sort]);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data || !id) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Volte e escolha outro evento.' }} />;
  }
  const { event, venue } = q.data;
  const ask = () => router.push(`/comunidade/nova?eventId=${id}&kind=${kind}` as Href);

  return (
    <Frame footer={<Button label="Perguntar sobre este evento" fullWidth onPress={ask} />}>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
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
        {list.length ? (
          <View>
            {list.map((t) => (
              <ThreadCard
                key={t.id}
                eventName={t.eventName}
                kind={t.kind}
                title={t.title}
                topComment={t.top}
                replies={t.replies}
                ago={formatRelative(t.createdAt)}
                onPress={() => router.push(`/comunidade/t/${t.id}` as Href)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="Ainda sem conversas"
            message={`Ninguém perguntou "${KIND_LABEL[kind]}" sobre este evento. Seja o primeiro.`}
            actionLabel="Perguntar"
            onAction={ask}
          />
        )}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.lg, paddingTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
