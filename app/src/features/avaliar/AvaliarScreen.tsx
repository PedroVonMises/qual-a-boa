import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { formatEventDate } from '@/domain/format';
import { StateShell, useGoBack } from '@/features/evento/Frame';
import { useReviews } from '@/state/reviews';
import { space } from '@/theme/tokens';
import { Button, Chip, Rating, Text } from '@/ui';
import { RATING_WORDS, TAGS, TOPICS } from './content';
import { useDraft } from './draft';
import { Shell } from './Shell';
import { TopicRow } from './TopicRow';

export function AvaliarScreen({ id }: { id?: string }) {
  const router = useRouter();
  const goBack = useGoBack();
  const q = useEvent(id);
  const draft = useDraft();
  const [error, setError] = useState<string | null>(null);

  // Start (or resume) the draft for this event. Editing a previous review prefills it.
  useEffect(() => {
    if (!id || useDraft.getState().eventId === id) return;
    const prev = useReviews.getState().mineFor(id);
    useDraft.getState().open(id, prev ? { rating: prev.rating, topics: prev.topics, tags: prev.tags, text: prev.text ?? '', anonymous: prev.anonymous } : undefined);
  }, [id]);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data || !id) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Não foi possível abrir esta avaliação. Volte e escolha outro evento.' }} />;
  }

  const { event, venue } = q.data;
  const rating = draft.rating;

  const next = () => {
    if (!rating) {
      setError('Escolha uma nota de 1 a 5 estrelas para continuar.');
      return;
    }
    setError(null);
    router.push(`/avaliar/${id}/texto` as Href);
  };

  return (
    <Shell step={1} onBack={goBack} footer={<Button label="Continuar" fullWidth onPress={next} testID="avaliar-continuar" />}>
      <View style={styles.summary}>
        <Text variant="title" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {venue.name} · {formatEventDate(event.startsAt)}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="display" accessibilityRole="header">
          Como foi a noite?
        </Text>
        <Rating
          value={rating}
          onChange={(n) => {
            draft.setRating(n as 1 | 2 | 3 | 4 | 5);
            setError(null);
          }}
          testID="avaliar-rating"
        />
        <Text variant="title" accessibilityLiveRegion="polite">
          {rating ? `${rating} de 5 · ${RATING_WORDS[rating]}` : 'Toque nas estrelas'}
        </Text>
        {error ? (
          <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text variant="bodySm" tone="textMuted" accessibilityRole="header" style={styles.bold}>
          Por tópico (opcional)
        </Text>
        {TOPICS.map((t) => (
          <TopicRow key={t.key} label={t.label} value={draft.topics[t.key]} onChange={(v) => draft.setTopic(t.key, v)} />
        ))}
      </View>

      <View style={styles.block}>
        <Text variant="bodySm" tone="textMuted" accessibilityRole="header" style={styles.bold}>
          O que rolou?
        </Text>
        <View style={styles.tags}>
          {TAGS.map((tag) => (
            <Chip key={tag} label={tag} selected={draft.tags.includes(tag)} onPress={() => draft.toggleTag(tag)} />
          ))}
        </View>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 2 },
  block: { gap: space.sm },
  bold: { fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
