import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { KIND_LABEL, THREAD_KINDS, type ThreadKind } from '@/domain/community';
import { formatRelative } from '@/domain/format';
import { useFollows } from '@/state/follows';
import { space } from '@/theme/tokens';
import { Chip, EmptyState, IconButton, Screen, SegmentedControl, Text, ThreadCard } from '@/ui';
import { useThreads } from './hooks';

type Scope = 'all' | 'tonight' | 'following';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Para você' },
  { value: 'tonight', label: 'Hoje à noite' },
  { value: 'following', label: 'Seguindo' },
];

const EMPTY: Record<Scope, { title: string; message: string }> = {
  all: { title: 'Nada por aqui ainda', message: 'Seja o primeiro a perguntar sobre um evento.' },
  tonight: { title: 'Nada acontecendo agora', message: 'Conversas "Agora" aparecem aqui durante a noite.' },
  following: { title: 'Nenhuma conversa seguida', message: 'Siga um evento para ver as conversas dele aqui.' },
};

/** Comunidade tab: event-scoped threads, newest first, each previewing its "Mais útil" reply. */
export function FeedScreen() {
  const router = useRouter();
  const threads = useThreads();
  const follows = useFollows((s) => s.follows);
  const [scope, setScope] = useState<Scope>('all');
  const [kind, setKind] = useState<ThreadKind | undefined>();

  const list = useMemo(
    () =>
      threads.filter((t) => {
        if (t.archived || (kind && t.kind !== kind)) return false;
        if (scope === 'tonight') return t.kind === 'agora';
        if (scope === 'following') return !!t.eventId && !!follows[t.eventId];
        return true;
      }),
    [threads, kind, scope, follows],
  );

  return (
    <Screen scroll testID="comunidade-screen" contentStyle={styles.body}>
      <View style={styles.head}>
        <Text variant="display" accessibilityRole="header">
          Comunidade
        </Text>
        <IconButton icon="plus" label="Nova conversa" variant="filled" onPress={() => router.push('/comunidade/nova' as Href)} />
      </View>
      <SegmentedControl label="Mostrar" options={SCOPES} value={scope} onChange={setScope} />
      <View accessibilityRole="radiogroup" accessibilityLabel="Tipo de conversa" style={styles.chips}>
        <Chip label="Tudo" selected={!kind} onPress={() => setKind(undefined)} />
        {THREAD_KINDS.map((k) => (
          <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
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
          title={EMPTY[scope].title}
          message={EMPTY[scope].message}
          actionLabel="Nova conversa"
          onAction={() => router.push('/comunidade/nova' as Href)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.xxxl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
