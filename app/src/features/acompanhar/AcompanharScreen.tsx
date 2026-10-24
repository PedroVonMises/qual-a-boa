import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { formatEventDate } from '@/domain/format';
import { useFavorites } from '@/state/favorites';
import { unreadCount, useFollows } from '@/state/follows';
import { space } from '@/theme/tokens';
import { Button, EmptyState, Screen, ScreenHeader, Skeleton, Text } from '@/ui';
import { ChangeFeed } from './ChangeFeed';
import { FollowCard } from './FollowCard';
import { useNow } from './useNow';

function SavedRow({ eventId, nowMs }: { eventId: string; nowMs: number }) {
  const q = useEvent(eventId);
  const follow = useFollows((s) => s.follow);
  if (q.isPending) return <Skeleton height={56} radius={12} />;
  if (!q.data) return null;
  const { event, venue } = q.data;
  return (
    <View style={styles.savedRow}>
      <View style={styles.flex}>
        <Text variant="body" numberOfLines={1}>
          {event.title}
        </Text>
        <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
          {venue.name} · {formatEventDate(event.startsAt, nowMs)}
        </Text>
      </View>
      <Button label="Acompanhar" variant="secondary" accessibilityLabel={`Acompanhar ${event.title}`} onPress={() => follow(eventId)} />
    </View>
  );
}

/** Acompanhar: followed events with timeline + countdown, the change feed, and saved events one tap from following. */
export function AcompanharScreen() {
  const router = useRouter();
  const nowMs = useNow();
  const follows = useFollows((s) => s.follows);
  const changes = useFollows((s) => s.changes);
  const saved = useFavorites((s) => s.eventIds);

  const ids = useMemo(
    () => Object.values(follows).sort((a, b) => Date.parse(b.followedAt) - Date.parse(a.followedAt)).map((f) => f.eventId),
    [follows],
  );
  const toFollow = saved.filter((id) => !follows[id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const unread = unreadCount({ follows, changes });
  const subtitle = ids.length === 0 ? 'Nenhum evento ainda' : `${ids.length} ${ids.length === 1 ? 'evento' : 'eventos'}${unread ? ` · ${unread} ${unread === 1 ? 'novidade' : 'novidades'}` : ''}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Acompanhando" onBack={back} />
        <Text accessibilityLiveRegion="polite" variant="bodySm" tone="textMuted" style={{ marginBottom: space.md }}>
          {subtitle}
        </Text>

        {ids.length === 0 ? (
          <EmptyState
            title="Você ainda não acompanha nenhum evento"
            message={toFollow.length ? 'Escolha um dos seus salvos abaixo para receber avisos e ver a linha do tempo.' : 'Salve um evento e acompanhe mudanças de horário, preço e line-up.'}
            actionLabel={toFollow.length ? undefined : 'Ver eventos'}
            onAction={toFollow.length ? undefined : () => router.push('/' as Href)}
          />
        ) : (
          <View style={styles.stack}>
            {ids.map((id) => (
              <FollowCard key={id} eventId={id} nowMs={nowMs} />
            ))}
            <ChangeFeed changes={changes} nowMs={nowMs} />
          </View>
        )}

        {toFollow.length ? (
          <View style={[styles.stack, { marginTop: space.xl }]}>
            <Text variant="title" accessibilityRole="header">
              Salvos para acompanhar
            </Text>
            {toFollow.map((id) => (
              <SavedRow key={id} eventId={id} nowMs={nowMs} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: space.xxxl },
  stack: { gap: space.lg },
  flex: { flex: 1 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
});
