import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { formatCountdown, formatEventDate } from '@/domain/format';
import { isHttpsUrl } from '@/features/evento/linking';
import { useCheckins } from '@/state/checkins';
import { useFollows } from '@/state/follows';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Button, Chip, PressableScale, Skeleton, Text } from '@/ui';
import { countdownFor, buildTimeline, demoChanges, isDemoVenue } from './logic';
import { Timeline } from './Timeline';


export function FollowCard({ eventId, nowMs }: { eventId: string; nowMs: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { location } = useLocation();
  const q = useEvent(eventId, location);
  const follow = useFollows((s) => s.follows[eventId]);
  const setHasTicket = useFollows((s) => s.setHasTicket);
  const addChanges = useFollows((s) => s.addChanges);
  const checkedIn = useCheckins((s) => s.checkins.some((c) => c.eventId === eventId));
  const demo = isDemoVenue(q.data?.venue.slug);

  useEffect(() => {
    if (demo && follow) addChanges(demoChanges(eventId, nowMs));
    // Seed once per follow; the clock ticking must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, !!follow, eventId, addChanges]);

  if (!follow) return null;
  if (q.isPending) return <Skeleton height={220} radius={24} />;
  if (q.isError || !q.data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="bodySm" tone="textMuted">
          Não foi possível carregar este evento agora.
        </Text>
        <Button label="Tentar de novo" variant="secondary" onPress={() => q.refetch()} />
      </View>
    );
  }

  const { event, venue } = q.data;
  const go = (p: string) => router.push(p as Href);
  const cd = countdownFor(event, nowMs, formatCountdown);
  const steps = buildTimeline({ event, follow, checkedIn, nowMs });
  const canBuy = event.status !== 'cancelled' && isHttpsUrl(event.ticketUrl);

  return (
    <View testID={`follow-${eventId}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale accessibilityRole="link" accessibilityLabel={`${event.title}, abrir evento`} onPress={() => go(`/evento/${event.id}`)} style={styles.head}>
        <Text variant="headline" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {venue.name}
        </Text>
        <Text variant="mono">{formatEventDate(event.startsAt, nowMs)}</Text>
      </PressableScale>

      <View style={styles.count}>
        <Text variant="display" tone={cd.kind === 'before' || cd.kind === 'live' ? 'accent' : 'textMuted'}>
          {cd.label}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {cd.caption}
        </Text>
      </View>
      {cd.kind === 'cancelled' ? <Badge label="Evento cancelado" tone="danger" icon="close" /> : null}

      <Timeline steps={steps} />

      {event.status !== 'cancelled' && !event.isFree ? (
        <Chip
          label="Já tenho ingresso"
          selected={follow.hasTicket}
          onPress={() => setHasTicket(eventId, !follow.hasTicket)}
          style={styles.self}
        />
      ) : null}

      <View style={styles.actions}>
        <Button label="Avisos" variant="secondary" onPress={() => go(`/acompanhar/avisos?eventId=${encodeURIComponent(eventId)}`)} style={styles.flex} />
        <Button label="Ao vivo" variant="secondary" onPress={() => go(`/ao-vivo/${eventId}`)} style={styles.flex} />
      </View>
      {canBuy && !follow.hasTicket ? (
        <Button label="Ver ingressos" onPress={() => WebBrowser.openBrowserAsync(event.ticketUrl!.trim()).catch(() => undefined)} />
      ) : null}
      {cd.kind === 'after' ? <Button label="Avaliar a noite" onPress={() => go(`/avaliar/${eventId}`)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { gap: 2, minHeight: 44 },
  count: { gap: 2 },
  self: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
