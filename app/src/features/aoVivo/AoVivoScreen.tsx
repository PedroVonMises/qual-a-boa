import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import { formatBRL, formatRelative } from '@/domain/format';
import { DEMO_LABEL, eventPhase, isDemoVenue } from '@/features/acompanhar/logic';
import { getNow, useNow } from '@/features/acompanhar/useNow';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { openMaps } from '@/features/evento/linking';
import { useCheckins } from '@/state/checkins';
import { useFollows } from '@/state/follows';
import { useLive } from '@/state/live';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Button, Icon, IconButton, PressableScale, Text, useBreakpoint } from '@/ui';
import { checklistFor, CROWD_LABEL, CROWD_SCORE, demoReports, MUSIC_LABEL, QUEUE_LABEL, sampleLine, summarize } from './logic';
import { EndedPanel } from './EndedPanel';
import { MetricCard } from './MetricCard';
import { ReportSheet } from './ReportSheet';

const PHASE_BADGE = { before: 'Ainda não começou', live: 'Ao vivo agora', after: 'Encerrado' } as const;

/** Ao vivo: community-reported queue / crowd / music / door price, with age and sample size. */
export function AoVivoScreen({ id }: { id?: string }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const goBack = useGoBack();
  const router = useRouter();
  const nowMs = useNow();
  const { location } = useLocation();
  const q = useEvent(id, location);
  const mine = useLive((s) => s.reports);
  const report = useLive((s) => s.report);
  const checkedIn = useCheckins((s) => s.checkins.some((c) => c.eventId === id));
  const checkIn = useCheckins((s) => s.checkIn);
  const hasTicket = useFollows((s) => (id ? s.follows[id]?.hasTicket : false) ?? false);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const demo = isDemoVenue(q.data?.venue.slug);
  const reports = useMemo(() => {
    if (!id) return [];
    const own = mine.filter((r) => r.eventId === id);
    return demo ? [...own, ...demoReports(id, nowMs)] : own;
  }, [id, mine, demo, nowMs]);
  const summary = useMemo(() => summarize(reports, nowMs), [reports, nowMs]);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data || !id) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Ele pode ter sido removido. Volte e veja o que está rolando hoje.' }} />;
  }

  const { event, venue } = q.data;
  const phase = eventPhase(event, nowMs);
  const ended = phase === 'after';
  const items = checklistFor(event.ageMin, hasTicket);
  const toggle = (k: string) => setDone((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const rel = (iso: string) => formatRelative(iso, nowMs);

  return (
    <Frame
      footer={
        <>
          <Button label="Como chegar" variant="secondary" icon="pin" onPress={() => openMaps(venue.name, venue.lat, venue.lng)} style={styles.flex} />
          {checkedIn ? (
            <Badge label="Você está aqui" tone="success" icon="check" style={styles.badgeFoot} />
          ) : (
            <Button
              label="Estou aqui"
              icon="check"
              accessibilityHint="Registra que você chegou e libera relatos e a avaliação"
              onPress={() => {
                checkIn(id, new Date(getNow()).toISOString());
                setNotice('Check-in feito. Agora você pode enviar relatos.');
              }}
              style={styles.flex}
            />
          )}
        </>
      }>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.top}>
          <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={goBack} />
        </View>
        <Badge label={PHASE_BADGE[phase]} tone={phase === 'live' ? 'accent' : 'neutral'} icon={phase === 'live' ? 'clock' : undefined} />
        <Text variant="display" accessibilityRole="header">
          {event.title}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {venue.name}
          {demo ? ` · ${DEMO_LABEL}` : ''}
        </Text>

        {ended ? (
          <EndedPanel onRate={() => router.push(`/avaliar/${id}` as Href)} />
        ) : (
          <>
        <View style={styles.grid}>
          <MetricCard testID="metric-queue" label="Fila" metric={summary.queue} valueText={summary.queue && QUEUE_LABEL[summary.queue.value]} nowMs={nowMs} />
          <MetricCard
            testID="metric-crowd"
            label="Lotação"
            metric={summary.crowd}
            valueText={summary.crowd && CROWD_LABEL[summary.crowd.value]}
            extra={summary.crowd ? `${CROWD_SCORE[summary.crowd.value]} de 5` : undefined}
            nowMs={nowMs}
          />
          <MetricCard testID="metric-music" label="Música" metric={summary.music} valueText={summary.music && MUSIC_LABEL[summary.music.value]} nowMs={nowMs} />
          <MetricCard testID="metric-price" label="Na porta" metric={summary.price} valueText={summary.price && formatBRL(summary.price.value)} nowMs={nowMs} />
        </View>
        <Text accessibilityLiveRegion="polite" variant="bodySm" tone="textMuted">
          {sampleLine(summary, rel)}
        </Text>

        <View style={styles.reportRow}>
          <Button
            label="Relatar agora"
            variant="secondary"
            disabled={!checkedIn}
            onPress={() => setSheet(true)}
            accessibilityHint={checkedIn ? undefined : 'Disponível depois de tocar em Estou aqui'}
            style={styles.flex}
          />
        </View>
        {checkedIn ? null : (
          <Text variant="caption" tone="textMuted">
            Para relatar, toque em Estou aqui quando chegar. Assim os relatos vêm de quem está lá.
          </Text>
        )}
        <Text accessibilityLiveRegion="polite" variant="bodySm" tone="success" style={notice ? undefined : styles.hidden}>
          {notice}
        </Text>

          </>
        )}

        {ended ? null : (
        <View style={styles.section}>
          <Text variant="title" accessibilityRole="header">
            Antes de sair
          </Text>
          {items.map((it) => {
            const on = done.includes(it.key);
            return (
              <PressableScale
                key={it.key}
                accessibilityRole="checkbox"
                accessibilityLabel={it.label}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(it.key)}
                scaleTo={0.99}
                style={styles.check}>
                {on ? <Icon name="check" size={22} color="success" strokeWidth={2.5} /> : <View style={[styles.hollow, { borderColor: colors.textMuted }]} />}
                <Text variant="body" tone={on ? 'textMuted' : 'text'}>
                  {it.label}
                  {on ? ' · feito' : ''}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        )}
      </View>

      <ReportSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onSubmit={(input) => {
          const r = report({ eventId: id, ...input }, new Date(getNow()).toISOString());
          setSheet(false);
          setNotice(r ? 'Relato enviado. Obrigado por ajudar quem está chegando.' : 'Escolha ao menos uma opção para enviar.');
        }}
      />
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.md, paddingTop: space.sm },
  top: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  reportRow: { flexDirection: 'row' },
  hidden: { height: 0 },
  section: { gap: space.xs, marginTop: space.md },
  check: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.sm },
  hollow: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, margin: 2 },
  badgeFoot: { alignSelf: 'center' },
});
