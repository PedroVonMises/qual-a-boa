import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { COMMENT_MAX, sortComments, topHelpful, type Comment, type CommunitySort } from '@/domain/community';
import { defaultSort } from '@/domain/community';
import { formatRelative } from '@/domain/format';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { useCommunity } from '@/state/community';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space, type } from '@/theme/tokens';
import { Button, Chip, CommentItem, EmptyState, IconButton, KindChip, Switch, Text, useBreakpoint } from '@/ui';
import { HandleField } from './HandleField';
import { useComments, useThread } from './hooks';

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: 'helpful', label: 'Mais úteis' },
  { value: 'recent', label: 'Recentes' },
];

function Composer({ threadId, replyTo, onDone }: { threadId: string; replyTo?: Comment; onDone: () => void }) {
  const { colors } = useTheme();
  const handle = useCommunity((s) => s.handle);
  const addComment = useCommunity((s) => s.addComment);
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const send = () => {
    const r = addComment({ threadId, parentId: replyTo?.id, body, anonymous });
    if (typeof r === 'string') return setError(r);
    setBody('');
    setError(undefined);
    onDone();
  };

  return (
    <View style={styles.composer}>
      {replyTo ? (
        <Text variant="bodySm" tone="textMuted">
          Respondendo {replyTo.author.anonymous ? 'anônimo' : `@${replyTo.author.handle}`}
        </Text>
      ) : null}
      {!handle && !anonymous ? <HandleField /> : null}
      <TextInput
        testID="comunidade-resposta"
        multiline
        value={body}
        onChangeText={(t) => {
          setBody(t.slice(0, COMMENT_MAX));
          if (error) setError(undefined);
        }}
        maxLength={COMMENT_MAX}
        accessibilityLabel="Sua resposta"
        placeholder="Ajude com o que você sabe"
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: error ? colors.danger : colors.border },
        ]}
      />
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Switch label="Responder como anônimo" value={anonymous} onValueChange={setAnonymous} />
      <Button label="Enviar resposta" fullWidth onPress={send} testID="comunidade-enviar" />
    </View>
  );
}

/** Thread detail: the post, the pinned "Mais útil" reply, nested replies (depth 1) and a composer. */
export function ThreadScreen({ id }: { id?: string }) {
  const { gutter } = useBreakpoint();
  const goBack = useGoBack();
  const thread = useThread(id);
  const comments = useComments(id);
  const votedIds = useCommunity((s) => s.votedIds);
  const toggleHelpful = useCommunity((s) => s.toggleHelpful);
  const reportedIds = useCommunity((s) => s.reportedIds);
  const report = useCommunity((s) => s.report);
  const [sortOverride, setSortOverride] = useState<CommunitySort | undefined>();
  const [replyTo, setReplyTo] = useState<Comment | undefined>();

  const sort = sortOverride ?? (thread ? defaultSort(thread.kind) : 'helpful');
  const tops = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const top = useMemo(() => topHelpful(tops, votedIds), [tops, votedIds]);
  const rest = useMemo(() => sortComments(tops.filter((c) => c.id !== top?.id), sort, votedIds), [tops, top, sort, votedIds]);
  const repliesOf = (c: Comment) =>
    comments.filter((r) => r.parentId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  if (!thread) {
    return <StateShell state="missing" notFound={{ title: 'Conversa não encontrada', message: 'Ela pode ter sido removida.' }} />;
  }

  const item = (c: Comment, opts: { top?: boolean; depth?: 0 | 1 }) => (
    <CommentItem
      key={c.id}
      testID={`comentario-${c.id}`}
      handle={c.author.handle}
      avatarHue={c.author.avatarHue}
      anonymous={c.author.anonymous}
      ago={formatRelative(c.createdAt)}
      body={c.body}
      helpfulCount={c.helpfulCount + (votedIds.includes(c.id) ? 1 : 0)}
      helpful={votedIds.includes(c.id)}
      top={opts.top}
      depth={opts.depth ?? 0}
      onToggleHelpful={() => toggleHelpful(c.id)}
      onReply={opts.depth === 1 ? undefined : () => setReplyTo(c)}
      canVote={!c.mine}
      onReport={c.mine ? undefined : () => report(c.id, 'comment')}
      reported={reportedIds.includes(c.id)}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Frame>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={goBack} />
            <View style={styles.flex}>
              <Text variant="bodySm" style={styles.bold}>
                {thread.eventName}
              </Text>
              <KindChip kind={thread.kind} />
            </View>
          </View>
          <Text variant="headline" accessibilityRole="header">
            {thread.title}
          </Text>
          {thread.body ? <Text variant="body">{thread.body}</Text> : null}
          <Text variant="bodySm" tone="textMuted">
            {thread.author.anonymous ? 'Anônimo' : `@${thread.author.handle}`} · {formatRelative(thread.createdAt)}
          </Text>

          <View style={styles.sortRow}>
            <Text variant="bodySm" tone="textMuted">
              {comments.length} {comments.length === 1 ? 'resposta' : 'respostas'}
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar respostas" style={styles.chips}>
              {SORTS.map((o) => (
                <Chip key={o.value} label={o.label} selected={sort === o.value} onPress={() => setSortOverride(o.value)} />
              ))}
            </View>
          </View>

          {comments.length === 0 ? (
            <EmptyState title="Sem respostas ainda" message="Quem já foi pode ajudar. Responda abaixo." />
          ) : (
            <View style={styles.list}>
              {top ? item(top, { top: true }) : null}
              {top ? repliesOf(top).map((r) => item(r, { depth: 1 })) : null}
              {rest.map((c) => (
                <View key={c.id}>
                  {item(c, {})}
                  {repliesOf(c).map((r) => item(r, { depth: 1 }))}
                </View>
              ))}
            </View>
          )}

          <Composer key={replyTo?.id ?? 'root'} threadId={thread.id} replyTo={replyTo} onDone={() => setReplyTo(undefined)} />
        </View>
      </Frame>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  body: { gap: space.md, paddingTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sortRow: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
  composer: { gap: space.md, paddingTop: space.lg },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
    textAlignVertical: 'top',
  },
});
