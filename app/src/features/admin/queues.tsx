import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  moderatePost,
  replyTicket,
  reviewAccount,
  reviewEvent,
  reviewSafety,
  useAdminMutation,
  useHiddenPosts,
  usePendingAccounts,
  usePendingEvents,
  useRecentActions,
  useSafetyQueue,
  useSafetyReports,
} from '@/data/admin';
import {
  accountPlace,
  actionLabel,
  ageLabel,
  formatCnpj,
  INCIDENT_LABEL,
  SEAL_LABEL,
  slaState,
  TICKET_LABEL,
  type SafetyReportItem,
} from '@/domain/admin';
import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { Card, Note, SummaryRow, casasStyles } from '@/features/casas/parts';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Button, EmptyState, Text, TextField } from '@/ui';
import { DecisionCard, ImageLink, QueueState } from './parts';

// --- Festas pendentes --------------------------------------------------------------------------------------------------

export function FestasQueue() {
  const q = usePendingEvents(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-festas" />;
  if (q.data.length === 0) return <EmptyState title="Nenhuma festa esperando" message="As festas que as casas cadastrarem aparecem aqui." />;
  return (
    <View style={casasStyles.gap} testID="admin-festas">
      {q.data.map((e) => (
        <DecisionCard
          key={e.id}
          testID={`admin-festa-${e.id}`}
          noteLabel="Motivo da recusa (a casa vai ler)"
          decisions={[
            { key: 'aprovar', label: 'Aprovar', variant: 'primary', run: () => reviewEvent(e.id, true) },
            { key: 'recusar', label: 'Recusar', needsNote: true, run: (note) => reviewEvent(e.id, false, note) },
          ]}>
          <Text variant="title">{e.title}</Text>
          <Text variant="bodySm" tone="textMuted">{`${e.venueName}${e.accountName ? ` · ${e.accountName}` : ''}`}</Text>
          <View>
            <SummaryRow label="Quando" value={formatEventDate(e.startsAt)} />
            <SummaryRow label="Preço" value={formatPriceLabel(e.priceMin, e.priceMax, e.isFree)} />
            <SummaryRow label="Idade mínima" value={`${e.ageMin} anos`} />
            {e.genreSlugs.length ? <SummaryRow label="Gêneros" value={e.genreSlugs.join(', ')} /> : null}
            {e.dressCode ? <SummaryRow label="Dress code" value={e.dressCode} /> : null}
            {e.ticketUrl ? <SummaryRow label="Ingressos" value={e.ticketUrl} mono /> : null}
            <SummaryRow label="Enviada" value={ageLabel(e.submittedAt)} divider={false} />
          </View>
          {e.posterPath ? <ImageLink path={e.posterPath} label="Ver cartaz" testID={`admin-festa-${e.id}-cartaz`} /> : null}
        </DecisionCard>
      ))}
    </View>
  );
}

// --- Casas a verificar -------------------------------------------------------------------------------------------------

export function CasasQueue() {
  const q = usePendingAccounts(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-casas" />;
  if (q.data.length === 0) return <EmptyState title="Nenhuma casa esperando" message="Os pedidos de vínculo de casas aparecem aqui." />;
  return (
    <View style={casasStyles.gap} testID="admin-casas">
      {q.data.map((a) => {
        const place = accountPlace(a);
        return (
          <DecisionCard
            key={a.id}
            testID={`admin-casa-${a.id}`}
            noteLabel="Observação (obrigatória para recusar)"
            decisions={[
              { key: 'verificar', label: 'Verificar casa', variant: 'primary', run: (note) => reviewAccount(a.id, true, note) },
              { key: 'recusar', label: 'Recusar', needsNote: true, run: (note) => reviewAccount(a.id, false, note) },
            ]}>
            <Text variant="title">{place.title}</Text>
            {place.detail ? <Text variant="bodySm" tone={place.needsLocation ? 'dangerText' : 'textMuted'}>{place.detail}</Text> : null}
            <View>
              <SummaryRow label="Razão social" value={a.legalName} />
              <SummaryRow label="CNPJ" value={formatCnpj(a.cnpj)} mono />
              <SummaryRow label="Responsável" value={a.contactName} />
              <SummaryRow label="WhatsApp" value={a.whatsapp} mono />
              <SummaryRow label="Pedido" value={ageLabel(a.createdAt)} divider={false} />
            </View>
            <Text variant="bodySm" tone="textMuted">
              Confira o CNPJ na Receita e fale com o responsável no WhatsApp antes de verificar.
            </Text>
          </DecisionCard>
        );
      })}
    </View>
  );
}

// --- Selo S1 -------------------------------------------------------------------------------------------------------------

export function SelosQueue() {
  const q = useSafetyQueue(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-selos" />;
  if (q.data.length === 0) return <EmptyState title="Nenhum selo para revisar" message="Declarações novas e selos contestados aparecem aqui." />;
  return (
    <View style={casasStyles.gap} testID="admin-selos">
      {q.data.map((s) => (
        <DecisionCard
          key={s.venueId}
          testID={`admin-selo-${s.venueId}`}
          noteLabel="Motivo (obrigatório para recusar ou contestar)"
          decisions={[
            { key: 'verificar', label: 'Verificar selo', variant: 'primary', run: (note) => reviewSafety(s.venueId, 'verify', note) },
            { key: 'contestar', label: 'Contestar', needsNote: true, run: (note) => reviewSafety(s.venueId, 'contest', note) },
            { key: 'recusar', label: 'Recusar', needsNote: true, run: (note) => reviewSafety(s.venueId, 'reject', note) },
          ]}>
          <View style={styles.head}>
            <Text variant="title" style={styles.flex}>{s.venueName}</Text>
            <Badge label={SEAL_LABEL[s.state]} tone={s.state === 'contested' ? 'danger' : 'accent'} />
          </View>
          <View>
            <SummaryRow label="Responsável" value={s.responsibleName ?? 'Não informado'} />
            <SummaryRow label="Relatos em 90 dias" value={String(s.reports90d)} />
            <SummaryRow label="Desde" value={s.stateAt ? ageLabel(s.stateAt) : '-'} divider={false} />
          </View>
          {s.evidencePath ? <ImageLink path={s.evidencePath} label="Ver foto do cartaz" testID={`admin-selo-${s.venueId}-foto`} /> : null}
        </DecisionCard>
      ))}
    </View>
  );
}

// --- Moderação -------------------------------------------------------------------------------------------------------------

export function ModeracaoQueue() {
  const q = useHiddenPosts(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-moderacao" />;
  if (q.data.length === 0) return <EmptyState title="Nada oculto para revisar" message="Posts ocultados por denúncias aparecem aqui." />;
  return (
    <View style={casasStyles.gap} testID="admin-moderacao">
      {q.data.map((p) => (
        <DecisionCard
          key={p.id}
          testID={`admin-post-${p.id}`}
          noteLabel="Observação para o log (opcional)"
          decisions={[
            { key: 'manter', label: 'Manter oculto', variant: 'primary', run: (note) => moderatePost(p.kind, p.id, 'keep_hidden', note) },
            { key: 'republicar', label: 'Republicar', run: (note) => moderatePost(p.kind, p.id, 'restore', note) },
          ]}>
          <Text variant="caption" tone="textMuted">{`${p.kind === 'thread' ? 'Pergunta' : 'Resposta'} · ${ageLabel(p.createdAt)}${p.anonymous ? ' · anônima' : ''}`}</Text>
          {p.title ? <Text variant="title">{p.title}</Text> : null}
          {p.body ? <Text variant="body">{p.body}</Text> : null}
          <Text variant="bodySm" tone="textMuted">
            {p.reportCount === 1 ? '1 denúncia' : `${p.reportCount} denúncias`}
            {p.reasons.length ? `: ${p.reasons.join(' · ')}` : ''}
          </Text>
        </DecisionCard>
      ))}
      <Note text="Republicar apaga as denúncias deste post. Denúncias novas ainda podem ocultá-lo de novo." />
    </View>
  );
}

// --- Relatos de segurança ------------------------------------------------------------------------------------------------------

function RelatoCard({ r }: { r: SafetyReportItem }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useAdminMutation((v: { close: boolean }) => replyTicket(r.ticketId, text, v.close));
  const sla = r.status === 'open' ? slaState(r.createdAt) : null;

  const send = async (close: boolean) => {
    if (!text.trim()) {
      setError('Escreva a resposta.');
      return;
    }
    setError(null);
    const res = await m.mutateAsync({ close });
    if (res.ok) setText('');
    else setError(res.error);
  };

  return (
    <Card testID={`admin-relato-${r.ticketId}`}>
      <View style={styles.head}>
        <Text variant="title" style={styles.flex}>{`${INCIDENT_LABEL[r.kind]} · ${r.venueName}`}</Text>
        <Badge label={TICKET_LABEL[r.status]} tone={r.status === 'open' ? 'danger' : 'neutral'} />
      </View>
      <Text variant="bodySm" tone={sla?.late ? 'dangerText' : 'textMuted'} testID={`admin-relato-${r.ticketId}-prazo`}>
        {[ageLabel(r.createdAt), sla?.label, r.eventTitle, r.checkedIn ? 'com check-in na casa' : 'sem check-in'].filter(Boolean).join(' · ')}
      </Text>
      <Text variant="body">{r.description}</Text>
      {r.messages.map((msg, i) => (
        <View
          key={i}
          style={[styles.bubble, { backgroundColor: msg.sender === 'support' ? colors.surfaceAlt : 'transparent', borderColor: colors.border }]}>
          <Text variant="caption" tone="textMuted">{msg.sender === 'support' ? 'Equipe' : 'Pessoa'}</Text>
          <Text variant="bodySm">{msg.text}</Text>
        </View>
      ))}
      {r.status !== 'closed' ? (
        <>
          <TextField
            label="Resposta (chega em Mensagens)"
            value={text}
            onChangeText={setText}
            maxLength={4000}
            multiline
            testID={`admin-relato-${r.ticketId}-texto`}
          />
          <View style={casasStyles.row}>
            <Button label="Responder" variant="primary" loading={m.isPending && !m.variables?.close} disabled={m.isPending} onPress={() => void send(false)} testID={`admin-relato-${r.ticketId}-responder`} />
            <Button label="Responder e encerrar" variant="secondary" loading={m.isPending && !!m.variables?.close} disabled={m.isPending} onPress={() => void send(true)} testID={`admin-relato-${r.ticketId}-encerrar`} />
          </View>
          <Note text={error} tone="error" testID={`admin-relato-${r.ticketId}-erro`} />
        </>
      ) : null}
    </Card>
  );
}

export function RelatosQueue() {
  const q = useSafetyReports(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-relatos" />;
  if (q.data.length === 0) return <EmptyState title="Nenhum relato" message="Relatos de assédio dos últimos 30 dias aparecem aqui." />;
  return (
    <View style={casasStyles.gap} testID="admin-relatos">
      <Note text="Responda em até 12 horas. A identidade da pessoa não aparece aqui; a conversa segue em Mensagens." />
      {q.data.map((r) => (
        <RelatoCard key={r.ticketId} r={r} />
      ))}
    </View>
  );
}

// --- Log ------------------------------------------------------------------------------------------------------------------------

export function LogList() {
  const { colors } = useTheme();
  const q = useRecentActions(true);
  if (q.isPending || q.error) return <QueueState loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} testID="admin-log" />;
  if (q.data.length === 0) return <EmptyState title="Nenhuma decisão ainda" message="Cada decisão da equipe fica registrada aqui." />;
  return (
    <Card testID="admin-log">
      {q.data.map((a, i) => (
        <View key={a.id} style={[styles.logRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]} testID={`admin-log-${a.id}`}>
          <Text variant="bodySm">{`${a.actorName ?? 'Equipe'} ${actionLabel(a.action)}`}</Text>
          <Text variant="caption" tone="textMuted">{`${formatEventDate(a.createdAt)}${a.note ? ` · ${a.note}` : ''}`}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bubble: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.xs },
  logRow: { gap: 2, paddingVertical: space.sm },
});
