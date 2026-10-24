import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useEvent } from '@/data/queries';
import type { SupportMessage } from '@/domain/engage';
import { formatEventDate } from '@/domain/format';
import { isAutomatic, useSupport } from '@/state/support';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, EmptyState, Icon, IconButton, PressableScale, Screen, ScreenHeader, Text } from '@/ui';
import { useReduceMotion } from '@/ui/useReduceMotion';
import { AttachSoon, StatusBadge } from './parts';
import { QUICK_REPLIES, SECURITY_NOTE, ticketNumber, topicLabel } from './tickets';

function Dot({ delay, animate }: { delay: number; animate: boolean }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.4);
  useEffect(() => {
    if (!animate) return;
    o.value = withRepeat(withSequence(withTiming(1, { duration: 400 + delay }), withTiming(0.4, { duration: 400 })), -1);
  }, [animate, delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: animate ? o.value : 0.8 }));
  return <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, style]} />;
}

/** Always mounted so assistive tech announces when it appears. Dots stand still with Reduce Motion. */
export function TypingIndicator({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="text" accessibilityLabel={visible ? 'A equipe está escrevendo' : undefined}>
      {visible ? (
        <View testID="typing-indicator" style={[styles.bubble, styles.typing, { backgroundColor: colors.surface }]}>
          <Dot delay={0} animate={!reduce} />
          <Dot delay={120} animate={!reduce} />
          <Dot delay={240} animate={!reduce} />
          <Text variant="caption" tone="textMuted">
            Equipe escrevendo
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Bubble({ m, now }: { m: SupportMessage; now: number }) {
  const { colors } = useTheme();
  const mine = m.from === 'user';
  const auto = isAutomatic(m);
  const who = mine ? 'Você' : auto ? 'Mensagem automática' : 'Equipe';
  const time = formatEventDate(m.at, now);
  return (
    <View style={[styles.msgWrap, mine ? styles.end : styles.start]}>
      <View
        accessible
        accessibilityLabel={`${who}, ${time}. ${m.text}${mine ? (m.readAt ? '. Lida' : '. Enviada') : ''}`}
        style={[
          styles.bubble,
          mine ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        ]}>
        {!mine ? (
          <Text variant="caption" tone="textMuted">
            {auto ? 'Mensagem automática' : 'Equipe Qual a boa?'}
          </Text>
        ) : null}
        <Text variant="body" tone={mine ? colors.onAccent : 'text'}>
          {m.text}
        </Text>
      </View>
      <View style={styles.meta}>
        {mine ? <Icon name="check" size={12} color="textMuted" strokeWidth={m.readAt ? 3 : 1.75} /> : null}
        <Text variant="caption" tone="textMuted">
          {mine ? `${m.readAt ? 'Lida' : 'Enviada'} · ${time}` : time}
        </Text>
      </View>
    </View>
  );
}

/** Conversa com o suporte. Replies are never simulated: the only support message is the automatic acknowledgement. */
export function ConversaScreen({ typing = false }: { typing?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useSupport((s) => s.tickets.find((t) => t.id === id));
  const sendMessage = useSupport((s) => s.sendMessage);
  const markRead = useSupport((s) => s.markRead);
  const closeTicket = useSupport((s) => s.closeTicket);
  const event = useEvent(ticket?.eventId);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollViewInstance>(null);
  const [now] = useState(() => Date.now());
  const unread = ticket?.messages.filter((m) => m.from === 'support' && !m.readAt).length ?? 0;

  useEffect(() => {
    if (id && unread > 0) markRead(id);
  }, [id, unread, markRead]);

  if (!ticket) {
    return (
      <Screen testID="conversa-screen">
        <ScreenHeader title="Suporte" onBack={() => router.back()} />
        <EmptyState title="Chamado não encontrado" message="Ele pode ter sido removido deste aparelho." actionLabel="Ver mensagens" onAction={() => router.replace('/ajuda/mensagens')} />
      </Screen>
    );
  }

  const last = ticket.messages[ticket.messages.length - 1];
  const showQuick = last?.from === 'support' && ticket.status !== 'closed';
  const send = (text: string) => {
    if (sendMessage(ticket.id, text)) setDraft('');
  };
  const detail = event.data;

  return (
    <Screen testID="conversa-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Conversa com o suporte" onBack={() => router.back()} />
        <View style={styles.sub}>
          <Text variant="bodySm" tone="textMuted" style={styles.flex}>
            {topicLabel(ticket.topic)} · chamado nº {ticketNumber(ticket.id)}
          </Text>
          <StatusBadge status={ticket.status} />
        </View>

        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
          {detail ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Sobre este evento: ${detail.event.title}`}
              onPress={() => router.push(`/evento/${detail.event.id}`)}
              style={[styles.context, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.flex}>
                <Text variant="caption" tone="textMuted">
                  Sobre este evento
                </Text>
                <Text variant="body" numberOfLines={1}>
                  {detail.event.title}
                </Text>
                <Text variant="bodySm" tone="textMuted">
                  {formatEventDate(detail.event.startsAt, now)}
                </Text>
              </View>
              <Icon name="chevronRight" size={20} color="textMuted" />
            </PressableScale>
          ) : null}

          {ticket.messages.map((m) => (
            <Bubble key={m.id} m={m} now={now} />
          ))}
          <TypingIndicator visible={typing} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text variant="caption" tone="textMuted" accessibilityRole="text">
            {SECURITY_NOTE}
          </Text>
          {showQuick ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} keyboardShouldPersistTaps="handled">
              {QUICK_REPLIES.map((q) => (
                <PressableScale
                  key={q}
                  accessibilityRole="button"
                  accessibilityLabel={`Resposta rápida: ${q}`}
                  onPress={() => send(q)}
                  style={[styles.quickChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text variant="bodySm">{q}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          ) : null}
          {ticket.status === 'closed' ? (
            <Text variant="bodySm" tone="textMuted">
              Chamado encerrado. Escrever uma nova mensagem o reabre.
            </Text>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              testID="conversa-input"
              accessibilityLabel="Mensagem para o suporte"
              multiline
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreva sua mensagem"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
            <IconButton
              testID="conversa-enviar"
              icon="send"
              label="Enviar mensagem"
              variant="accent"
              disabled={draft.trim().length === 0}
              onPress={() => send(draft)}
            />
          </View>
          <View style={styles.actions}>
            <AttachSoon label="Anexar" />
            {ticket.status !== 'closed' ? <Button label="Encerrar chamado" variant="ghost" onPress={() => closeTicket(ticket.id)} /> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  thread: { gap: space.md, paddingVertical: space.md },
  context: {
    minHeight: 64,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  msgWrap: { maxWidth: '85%', gap: 2 },
  start: { alignSelf: 'flex-start' },
  end: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start' },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footer: { borderTopWidth: 1, paddingTop: space.sm, gap: space.sm, paddingBottom: space.sm },
  quick: { gap: space.sm },
  quickChip: { minHeight: hit.chip, paddingHorizontal: space.lg, borderRadius: radius.full, justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    minHeight: hit.button,
    maxHeight: 120,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
