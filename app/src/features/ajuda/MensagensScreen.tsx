import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { SupportTicket } from '@/domain/engage';
import { formatRelative } from '@/domain/format';
import { isAutomatic, useSupport } from '@/state/support';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, EmptyState, Icon, PressableScale, Screen, ScreenHeader, SegmentedControl, Text } from '@/ui';
import { ResponseTime, StatusBadge } from './parts';
import { topicLabel, ticketNumber } from './tickets';

type Tab = 'open' | 'closed';

function preview(t: SupportTicket): string {
  const last = t.messages[t.messages.length - 1];
  if (!last) return t.description;
  const who = last.from === 'user' ? 'Você' : isAutomatic(last) ? 'Automática' : 'Equipe';
  return `${who}: ${last.text}`;
}

function TicketRow({ ticket, onPress }: { ticket: SupportTicket; onPress: () => void }) {
  const { colors } = useTheme();
  const unread = ticket.messages.filter((m) => m.from === 'support' && !m.readAt).length;
  const last = ticket.messages[ticket.messages.length - 1];
  const when = formatRelative(last?.at ?? ticket.createdAt);
  return (
    <PressableScale
      testID={`ticket-${ticket.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${topicLabel(ticket.topic)}, chamado ${ticketNumber(ticket.id)}${unread ? `, ${unread} não lida` : ''}`}
      onPress={onPress}
      scaleTo={0.99}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowTop}>
        <Text variant="body" numberOfLines={1} style={styles.flex}>
          {topicLabel(ticket.topic)}
        </Text>
        <StatusBadge status={ticket.status} />
      </View>
      <Text variant="bodySm" tone="textMuted" numberOfLines={2}>
        {preview(ticket)}
      </Text>
      <View style={styles.rowTop}>
        <Text variant="caption" tone="textMuted" style={styles.flex}>
          Chamado nº {ticketNumber(ticket.id)} · {when}
        </Text>
        {unread > 0 ? (
          <Text variant="caption" tone="accent">
            {unread} nova
          </Text>
        ) : null}
        <Icon name="chevronRight" size={18} color="textMuted" />
      </View>
    </PressableScale>
  );
}

/** Mensagens: ticket inbox. */
export function MensagensScreen() {
  const router = useRouter();
  const tickets = useSupport((s) => s.tickets);
  const [tab, setTab] = useState<Tab>('open');
  const open = tickets.filter((t) => t.status !== 'closed');
  const closed = tickets.filter((t) => t.status === 'closed');
  const shown = tab === 'open' ? open : closed;

  return (
    <Screen testID="mensagens-screen">
      <ScreenHeader title="Mensagens" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <SegmentedControl<Tab>
          label="Filtrar chamados"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: `Abertos · ${open.length}` },
            { value: 'closed', label: `Encerrados · ${closed.length}` },
          ]}
        />
        {shown.length === 0 ? (
          <EmptyState
            title={tab === 'open' ? 'Nenhum chamado aberto' : 'Nenhum chamado encerrado'}
            message={tab === 'open' ? 'Precisa de ajuda? Abra um chamado e responderemos por aqui.' : undefined}
            actionLabel={tab === 'open' ? 'Novo chamado' : undefined}
            onAction={tab === 'open' ? () => router.push('/ajuda/novo') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {shown.map((t) => (
              <TicketRow key={t.id} ticket={t} onPress={() => router.push(`/ajuda/suporte/${t.id}`)} />
            ))}
          </View>
        )}
        <View style={styles.foot}>
          <ResponseTime />
          {shown.length > 0 ? <Button label="Novo chamado" icon="plus" fullWidth onPress={() => router.push('/ajuda/novo')} /> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.lg, paddingBottom: space.xxxl },
  flex: { flex: 1 },
  list: { gap: space.md },
  row: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, gap: space.sm, minHeight: 44 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foot: { gap: space.md },
});
