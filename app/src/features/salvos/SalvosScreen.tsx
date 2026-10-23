import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { useFavorites } from '@/state/favorites';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import {
  Badge, EmptyState, EventCard, EventCardSkeleton, IconButton, PressableScale, Screen, SegmentedControl, Text, VenueRow,
} from '@/ui';
import { groupSaved, type SavedEvent } from './grouping';
import { useSavedEvents, useSavedVenues } from './hooks';
import { UndoToast } from './UndoToast';

type Tab = 'eventos' | 'casas' | 'artistas';
const TABS = [
  { value: 'eventos' as const, label: 'Eventos' },
  { value: 'casas' as const, label: 'Casas' },
  { value: 'artistas' as const, label: 'Artistas' },
];

export function SalvosScreen({ now }: { now?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('eventos');
  const [undoId, setUndoId] = useState<string | null>(null);
  const nowIso = useMemo(() => now ?? new Date().toISOString(), [now]);
  const eventIds = useFavorites((s) => s.eventIds);
  const venueIds = useFavorites((s) => s.venueIds);
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const events = useSavedEvents(eventIds);
  const venues = useSavedVenues(venueIds);
  const groups = useMemo(() => groupSaved(events, nowIso), [events, nowIso]);
  const dismiss = useCallback(() => setUndoId(null), []);

  const explore = () => router.push('/');
  const remove = (id: string) => {
    toggleEvent(id);
    setUndoId(id);
  };
  const undo = () => {
    if (undoId && !useFavorites.getState().eventIds.includes(undoId)) toggleEvent(undoId);
    setUndoId(null);
  };

  const renderEvent = (it: SavedEvent, past: boolean) => {
    if (!it.data) {
      return (
        <View key={it.key} style={[styles.gone, { borderBottomColor: colors.border }]}>
          <Badge label="Evento removido" tone="danger" />
          <View style={styles.grow} />
          <IconButton icon="heartFilled" label="Remover dos salvos" color={colors.accent} onPress={() => remove(it.key)} />
        </View>
      );
    }
    const { event, venue } = it.data;
    const cancelled = event.status === 'cancelled';
    return (
      <View key={it.key}>
        {cancelled || past ? (
          <Badge label={cancelled ? 'Cancelado' : 'Já passou'} tone={cancelled ? 'danger' : 'neutral'} style={styles.status} />
        ) : null}
        <EventCard
          variant="row"
          divider
          testID={`saved-${event.id}`}
          title={event.title}
          venueName={venue.name}
          area={venue.area}
          coverKey={event.coverKey}
          dateLabel={formatEventDate(event.startsAt, nowIso)}
          priceLabel={formatPriceLabel(event.priceMin, event.priceMax, event.isFree)}
          saved
          onToggleSave={() => remove(event.id)}
          onPress={() => router.push(`/evento/${event.id}`)}
        />
      </View>
    );
  };

  const section = (title: string, list: SavedEvent[], past = false) =>
    list.length ? (
      <View key={title} style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {list.map((it) => renderEvent(it, past))}
      </View>
    ) : null;

  let body;
  if (tab === 'eventos') {
    body = eventIds.length === 0 ? (
      <EmptyState title="Nenhum evento salvo" message="Toque no coração de um evento para guardar aqui." actionLabel="Explorar eventos" onAction={explore} />
    ) : events.some((e) => e.loading) && events.every((e) => e.loading) ? (
      <EventCardSkeleton variant="row" />
    ) : (
      <>
        {section('Esta semana', groups.week)}
        {section('Mais tarde', groups.later)}
        {section('Já passaram', groups.past, true)}
      </>
    );
  } else if (tab === 'casas') {
    body = venueIds.length === 0 ? (
      <EmptyState title="Nenhuma casa salva" message="Salve casas para acompanhar a programação." actionLabel="Explorar eventos" onAction={explore} />
    ) : (
      <View style={styles.section}>
        {venues.map((v) =>
          v.data ? (
            <VenueRow
              key={v.key}
              divider
              name={v.data.venue.name}
              area={v.data.venue.area}
              coverKey={v.data.venue.coverKey}
              statusLabel={v.data.venue.status === 'open' ? 'Aberto' : undefined}
              onPress={() => router.push(`/casa/${v.key}`)}
            />
          ) : v.loading ? null : (
            <Badge key={v.key} label="Casa indisponível" tone="danger" style={styles.status} />
          ),
        )}
      </View>
    );
  } else {
    body = (
      <EmptyState title="Nenhum artista salvo" message="Artistas salvos aparecem aqui." actionLabel="Explorar eventos" onAction={explore} />
    );
  }

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="headline" accessibilityRole="header" style={styles.grow}>
          Salvos
        </Text>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Acompanhando, ${venueIds.length}`}
          onPress={() => router.push('/acompanhar')}
          style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
          <Text variant="bodySm">{`Acompanhando · ${venueIds.length}`}</Text>
        </PressableScale>
      </View>
      <SegmentedControl label="Tipo de salvo" options={TABS} value={tab} onChange={setTab} />
      {body}
      {undoId ? <UndoToast message="Evento removido dos salvos" onUndo={undo} onDismiss={dismiss} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  grow: { flex: 1 },
  pill: { minHeight: hit.min, paddingHorizontal: space.lg, borderRadius: radius.full, justifyContent: 'center' },
  section: { marginTop: space.xl, gap: space.xs },
  status: { alignSelf: 'flex-start', marginTop: space.sm },
  gone: { flexDirection: 'row', alignItems: 'center', minHeight: hit.min, borderBottomWidth: 1 },
});
