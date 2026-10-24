import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import type { Review } from '@/domain/engage';
import { formatRelative } from '@/domain/format';
import { TOPICS } from '@/features/avaliar/content';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { useReviews } from '@/state/reviews';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space } from '@/theme/tokens';
import { Badge, Button, Chip, EmptyState, IconButton, Rating, ScoreBar, Tag, Text, useBreakpoint } from '@/ui';
import { DEMO_REVIEWS, DEMO_VENUE_SLUG } from './demo';
import { computeStats, sortReviews, type ReviewSort } from './stats';

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'helpful', label: 'Mais úteis' },
  { value: 'critical', label: 'Críticas' },
];

function DistributionRow({ star, share, count }: { star: number; share: number; count: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${star} ${star === 1 ? 'estrela' : 'estrelas'}: ${count} ${count === 1 ? 'avaliação' : 'avaliações'}`} style={styles.distRow}>
      <Text variant="mono" style={styles.distStar}>
        {star}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { backgroundColor: palette.amber, width: `${Math.round(share * 100)}%` }]} />
      </View>
      <Text variant="mono" tone="textMuted" style={styles.distCount}>
        {count}
      </Text>
    </View>
  );
}

function ReviewCard({ review, demo }: { review: Review; demo: boolean }) {
  const { colors } = useTheme();
  const helpful = useReviews((s) => s.helpfulIds.includes(review.id));
  const reported = useReviews((s) => s.reportedIds.includes(review.id));
  const toggleHelpful = useReviews((s) => s.toggleHelpful);
  const report = useReviews((s) => s.report);
  const name = review.mine && !review.anonymous ? 'Você' : 'Frequentador';
  const pending = review.status === 'pending';
  return (
    <View accessible={false} style={[styles.card, { borderTopColor: colors.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
          <Text variant="body" style={styles.bold}>
            {name[0]}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodySm" style={styles.bold}>
            {name}
            {review.mine && review.anonymous ? ' (sua avaliação)' : ''}
          </Text>
          {review.attended ? <Badge label="Foi ao evento" tone="success" icon="check" /> : null}
        </View>
        <Text variant="bodySm" tone="textMuted">
          {formatRelative(review.createdAt)}
        </Text>
      </View>
      <Rating value={review.rating} />
      {pending ? <Badge label="Em análise" tone="neutral" icon="clock" /> : null}
      {demo ? <Tag label="Exemplo ilustrativo" /> : null}
      {review.text ? <Text variant="body">{review.text}</Text> : null}
      {review.tags.length ? (
        <View style={styles.tags}>
          {review.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </View>
      ) : null}
      {!review.mine ? (
        <View style={styles.actions}>
          <Chip
            label="Útil"
            count={review.helpfulCount + (helpful ? 1 : 0)}
            selected={helpful}
            onPress={() => toggleHelpful(review.id)}
            testID={`util-${review.id}`}
          />
          <Button
            label={reported ? 'Denúncia salva' : 'Denunciar'}
            variant="ghost"
            disabled={reported}
            onPress={() => report(review.id)}
            accessibilityHint="Salva a denúncia neste aparelho; a moderação ainda não a recebe"
            testID={`denunciar-${review.id}`}
          />
        </View>
      ) : null}
    </View>
  );
}

export function AvaliacoesScreen({ id, sent }: { id?: string; sent?: boolean }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const q = useEvent(id);
  const mine = useReviews((s) => s.mine);
  const helpfulIds = useReviews((s) => s.helpfulIds);
  const [sort, setSort] = useState<ReviewSort>('recent');

  const venueSlug = q.data?.venue.slug;
  const mineHere = mine.find((r) => r.eventId === id);
  const demo = venueSlug === DEMO_VENUE_SLUG;

  const stats = useMemo(() => computeStats(demo ? DEMO_REVIEWS : []), [demo]);
  const list = useMemo(() => {
    const others = demo ? DEMO_REVIEWS : [];
    const sorted = sortReviews(others, sort, (r) => r.helpfulCount + (helpfulIds.includes(r.id) ? 1 : 0));
    // The author's own review always sits on top, so "Em análise" is visible right after sending.
    return mineHere && (sort !== 'critical' || mineHere.rating <= 2) ? [mineHere, ...sorted] : sorted;
  }, [demo, sort, mineHere, helpfulIds]);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data || !id) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Volte e escolha outro evento para ver as avaliações.' }} />;
  }

  const { event, venue } = q.data;
  const toReview = () => router.push(`/avaliar/${id}` as Href);
  const hasPublished = stats.count > 0;
  const average = (Math.round(stats.average * 10) / 10).toString().replace('.', ',');

  return (
    <Frame
      footer={
        <Button label={mineHere ? 'Editar minha avaliação' : 'Avaliar este evento'} variant={mineHere ? 'secondary' : 'primary'} fullWidth onPress={toReview} />
      }>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={goBack} />
          <View style={styles.flex}>
            <Text variant="headline" accessibilityRole="header">
              Avaliações
            </Text>
            <Text variant="bodySm" tone="textMuted">
              {event.title} · {venue.name}
            </Text>
          </View>
        </View>

        {sent ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <Badge label="Avaliação enviada" tone="success" icon="check" />
            <Text variant="bodySm">Ela aparece para os outros depois da revisão.</Text>
          </View>
        ) : null}

        {demo ? (
          <Text variant="bodySm" tone="textMuted">
            Casa Maré é uma casa fictícia. As avaliações abaixo são exemplo ilustrativo.
          </Text>
        ) : null}

        {hasPublished ? (
          <>
            <View style={styles.summary}>
              <View style={styles.avgCol}>
                <Text variant="display" style={styles.avg} accessibilityLabel={`Nota média ${average} de 5`}>
                  {average}
                </Text>
                <Rating value={stats.average} />
                <Text variant="bodySm" tone="textMuted">
                  {stats.count} {stats.count === 1 ? 'avaliação' : 'avaliações'}
                </Text>
              </View>
              <View style={styles.flex}>
                {[5, 4, 3, 2, 1].map((s) => (
                  <DistributionRow key={s} star={s} share={stats.distribution[s - 1]} count={stats.counts[s - 1]} />
                ))}
              </View>
            </View>
            <View style={styles.topics}>
              {TOPICS.filter((t) => stats.topics[t.key] !== undefined).map((t) => (
                <ScoreBar key={t.key} label={t.label} value={stats.topics[t.key]!} />
              ))}
            </View>
          </>
        ) : null}

        {!hasPublished && !mineHere ? (
          <EmptyState
            title="Ainda sem avaliações"
            message="Este evento ainda não tem avaliações publicadas. Foi? Conte como foi a noite."
            actionLabel="Avaliar este evento"
            onAction={toReview}
          />
        ) : (
          <>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar avaliações" style={styles.tags}>
              {SORTS.map((o) => (
                <Chip key={o.value} label={o.label} selected={sort === o.value} onPress={() => setSort(o.value)} />
              ))}
            </View>
            {list.length ? (
              list.map((r) => <ReviewCard key={r.id} review={r} demo={!r.mine} />)
            ) : (
              <Text variant="body" tone="textMuted">
                Nenhuma avaliação neste filtro.
              </Text>
            )}
          </>
        )}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  body: { gap: space.lg, paddingTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  summary: { flexDirection: 'row', gap: space.xl, alignItems: 'center' },
  avg: { fontSize: 52, lineHeight: 54 },
  avgCol: { gap: space.xs, alignItems: 'flex-start' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 22 },
  distStar: { width: 14 },
  distCount: { width: 24, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.full },
  topics: { gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
