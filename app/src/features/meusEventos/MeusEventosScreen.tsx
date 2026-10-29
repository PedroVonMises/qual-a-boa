import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { formatEventDate, formatRelative } from '@/domain/format';
import { useCheckins } from '@/state/checkins';
import { useFollows } from '@/state/follows';
import { useReviews } from '@/state/reviews';
import { space } from '@/theme/tokens';
import { EmptyState, ListRow, Screen, ScreenHeader, SegmentedControl } from '@/ui';
import { REVIEW_STATUS_LABEL, sortCheckins, sortFollows, sortReviews, tabLabel, type MeusTab } from './logic';

interface RowProps {
  eventId: string;
  /** What this row adds under the event title, e.g. "Check-in há 2 h". */
  note: string;
  value?: string;
  /** Where tapping goes; defaults to the event page. */
  href?: string;
  testID: string;
}

/** One event the user has touched. Resolves the title from the catalog and degrades if it is gone. */
function EventRow({ eventId, note, value, href, testID }: RowProps) {
  const router = useRouter();
  const q = useEvent(eventId);
  const title = q.data ? q.data.event.title : q.isPending ? 'Carregando evento...' : 'Evento indisponível';
  const where = q.data ? `${q.data.venue.name} · ${formatEventDate(q.data.event.startsAt)} · ` : '';
  return (
    <ListRow
      title={title}
      subtitle={`${where}${note}`}
      value={value}
      chevron
      divider
      onPress={() => router.push((href ?? `/evento/${eventId}`) as Href)}
      testID={testID}
    />
  );
}

const EMPTY: Record<MeusTab, { title: string; message: string }> = {
  reviews: { title: 'Nenhuma avaliação ainda', message: 'Depois de ir a um evento, conte como foi a noite.' },
  checkins: { title: 'Nenhum check-in ainda', message: 'O check-in abre 2 h antes do evento e vale até ele acabar.' },
  follows: { title: 'Você não acompanha nenhum evento', message: 'Toque em "Acompanhar" num evento para receber avisos e ver o que mudou.' },
};

/** Meus eventos: your reviews, check-ins and followed events in one place. */
export function MeusEventosScreen() {
  const router = useRouter();
  const mine = useReviews((s) => s.mine);
  const checkins = useCheckins((s) => s.checkins);
  const follows = useFollows((s) => s.follows);
  const [tab, setTab] = useState<MeusTab>('reviews');

  const reviews = useMemo(() => sortReviews(mine), [mine]);
  const visits = useMemo(() => sortCheckins(checkins), [checkins]);
  const followed = useMemo(() => sortFollows(follows), [follows]);
  const count = { reviews: reviews.length, checkins: visits.length, follows: followed.length };

  return (
    <Screen testID="meus-eventos-screen">
      <ScreenHeader title="Meus eventos" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <SegmentedControl<MeusTab>
          label="Ver por tipo"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'reviews', label: tabLabel('Avaliações', count.reviews) },
            { value: 'checkins', label: tabLabel('Check-ins', count.checkins) },
            { value: 'follows', label: tabLabel('Acompanhando', count.follows) },
          ]}
        />
        {count[tab] === 0 ? (
          <EmptyState title={EMPTY[tab].title} message={EMPTY[tab].message} actionLabel="Explorar eventos" onAction={() => router.replace('/')} />
        ) : (
          <View>
            {tab === 'reviews'
              ? reviews.map((r) => (
                  <EventRow
                    key={r.id}
                    testID={`meus-review-${r.id}`}
                    eventId={r.eventId}
                    note={`Nota ${r.rating}/5 · ${formatRelative(r.createdAt)}`}
                    value={REVIEW_STATUS_LABEL[r.status]}
                    href={`/avaliacoes/${r.eventId}`}
                  />
                ))
              : null}
            {tab === 'checkins'
              ? visits.map((c) => (
                  <EventRow key={c.eventId} testID={`meus-checkin-${c.eventId}`} eventId={c.eventId} note={`Check-in ${formatRelative(c.at)}`} />
                ))
              : null}
            {tab === 'follows'
              ? followed.map((f) => (
                  <EventRow
                    key={f.eventId}
                    testID={`meus-follow-${f.eventId}`}
                    eventId={f.eventId}
                    note={`Acompanhando desde ${formatRelative(f.followedAt)}`}
                    value={f.hasTicket ? 'Com ingresso' : undefined}
                    href={`/acompanhar`}
                  />
                ))
              : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.lg, paddingBottom: space.xxxl },
});
