import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';
import { Button, EmptyState, ErrorState, Text, ThreadCardSkeleton } from '@/ui';
import type { ThreadFeed } from './hooks';

/** First load: a few skeleton cards. */
export function FeedLoading() {
  return (
    <View testID="comunidade-loading" style={styles.block}>
      {[0, 1, 2, 3].map((i) => (
        <ThreadCardSkeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Empty-list body: skeletons while loading, an error with retry, else the empty state given by the screen.
 * (Loading and failure used to look like "no conversations".)
 */
export function FeedEmpty({
  feed,
  title,
  message,
  actionLabel,
  onAction,
}: {
  feed: Pick<ThreadFeed, 'isLoading' | 'isError' | 'refresh'>;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (feed.isLoading) return <FeedLoading />;
  if (feed.isError) return <ErrorState onRetry={() => void feed.refresh()} />;
  return <EmptyState title={title} message={message} actionLabel={actionLabel} onAction={onAction} />;
}

/**
 * List footer: skeleton while the next page loads, an inline retry if it failed, and at the very end a calm
 * "you saw everything" with a reason to post instead of a dead end.
 */
export function FeedFooter({
  feed,
  onNew,
}: {
  feed: Pick<ThreadFeed, 'items' | 'hasNextPage' | 'isFetchingNextPage' | 'isFetchNextPageError' | 'fetchNextPage'>;
  onNew: () => void;
}) {
  if (feed.isFetchingNextPage) return <ThreadCardSkeleton />;
  if (feed.isFetchNextPageError) {
    return (
      <View testID="comunidade-next-error" style={styles.end} accessibilityRole="alert">
        <Text variant="bodySm" tone="textMuted">
          Não deu pra carregar mais conversas.
        </Text>
        <Button label="Tentar de novo" variant="secondary" onPress={feed.fetchNextPage} />
      </View>
    );
  }
  if (!feed.hasNextPage && feed.items.length > 0) {
    return (
      <View testID="comunidade-end" style={styles.end}>
        <Text variant="bodySm" tone="textMuted">
          Você viu tudo por aqui.
        </Text>
        <Button label="Começar uma conversa" variant="secondary" onPress={onNew} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  end: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
});
