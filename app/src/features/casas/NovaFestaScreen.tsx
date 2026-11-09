import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { POSTER_MAX_BYTES, useSubmitEvent, useUploadPoster, useVenueQuota } from '@/data/casas';
import { useArtistSearch, useGenres } from '@/data/queries';
import { casasErrorMessage, partyMonthKey, submissionBlocker, type CasasErrorCode, type VenueAccount } from '@/domain/casas';
import { coverFor } from '@/domain/cover';
import { space } from '@/theme/tokens';
import { Button, Chip, EmptyState, ErrorState, EventCard, ListRow, Skeleton, Switch, Text, TextField } from '@/ui';
import {
  draftDateLabel,
  draftPriceLabel,
  EMPTY_FESTA,
  ERROR_STEP,
  festaTimes,
  MAX_GENRES,
  maskDate,
  maskTime,
  monthName,
  parseDate,
  parseMoney,
  validateFestaStep,
  accountVenueName,
  type FestaDraft,
  type FestaErrors,
  type PosterPick,
} from './format';
import { Caption, Card, CasasShell, Note, StepBar, SummaryRow, casasStyles } from './parts';
import { draftFor, useCurrentAccount, useFestaDrafts } from './store';

const STEPS = ['Quando e estilo', 'Preço e ingresso', 'Line-up e cartaz', 'Revisão'] as const;
const MAX_LINEUP = 12;
const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Copy of a date-level blocker, attached to the date field. */
function dateError(code: CasasErrorCode, monthKey: string, limit: number): string {
  if (code === 'quota_exceeded') return `Você já usou as ${limit} festas de ${monthName(monthKey)}. Escolha uma data em outro mês.`;
  return casasErrorMessage(code);
}

function LineupStep({ draft, set }: { draft: FestaDraft; set: (p: Partial<FestaDraft>) => void }) {
  const [q, setQ] = useState('');
  const artists = useArtistSearch(q);
  const add = (name: string) => {
    const n = name.trim();
    if (!n || draft.lineup.includes(n) || draft.lineup.length >= MAX_LINEUP) return;
    set({ lineup: [...draft.lineup, n] });
    setQ('');
  };
  const suggestions = (artists.data ?? []).filter((a) => !draft.lineup.includes(a.name)).slice(0, 5);
  return (
    <View style={casasStyles.gap}>
      <TextField
        label="Buscar artista"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => add(q)}
        returnKeyType="done"
        placeholder="Nome do artista ou DJ"
        hint="Opcional. Toque num nome para tirar da lista."
        testID="festa-artista"
      />
      {q.trim() ? (
        <View>
          {suggestions.map((a) => (
            <ListRow key={a.id} title={a.name} icon="plus" onPress={() => add(a.name)} testID={`festa-artista-${a.slug}`} />
          ))}
          {!suggestions.some((a) => a.name.toLowerCase() === q.trim().toLowerCase()) ? (
            <ListRow title={`Adicionar “${q.trim()}”`} icon="plus" onPress={() => add(q)} testID="festa-artista-livre" />
          ) : null}
        </View>
      ) : null}
      {draft.lineup.length ? (
        <View style={casasStyles.wrapChips} accessibilityLabel="Line-up">
          {draft.lineup.map((n) => (
            <Chip key={n} label={n} selected onPress={() => set({ lineup: draft.lineup.filter((x) => x !== n) })} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PosterStep({ draft, set }: { draft: FestaDraft; set: (p: Partial<FestaDraft>) => void }) {
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const poster: PosterPick = { uri: a.uri, mimeType: a.mimeType ?? null, size: a.fileSize ?? null };
    if (!POSTER_TYPES.includes((poster.mimeType ?? '').toLowerCase())) return setError(casasErrorMessage('poster_type'));
    if (poster.size != null && poster.size > POSTER_MAX_BYTES) return setError(casasErrorMessage('poster_too_large'));
    set({ poster });
  };
  return (
    <View style={casasStyles.gap}>
      <Text variant="bodySm" tone="textMuted">
        {draft.poster ? 'Cartaz escolhido. Ele aparece na prévia do próximo passo.' : 'Sem cartaz, a festa usa uma arte do estilo escolhido.'}
      </Text>
      <Button label={draft.poster ? 'Trocar cartaz' : 'Escolher cartaz'} variant="secondary" onPress={() => void pick()} testID="festa-cartaz" />
      {draft.poster ? <Button label="Usar a arte do estilo" variant="ghost" onPress={() => set({ poster: null })} testID="festa-cartaz-remover" /> : null}
      <Note tone="error" text={error} testID="festa-cartaz-erro" />
      <Text variant="caption" tone="textMuted">
        JPG, PNG ou WebP, até 5 MB.
      </Text>
    </View>
  );
}

function Form({ account }: { account: VenueAccount }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();
  const genres = useGenres();
  const drafts = useFestaDrafts((s) => s.drafts);
  const saveDraft = useFestaDrafts((s) => s.saveDraft);
  const clearDraft = useFestaDrafts((s) => s.clearDraft);
  const submit = useSubmitEvent();
  const upload = useUploadPoster();

  const [draft, setDraft] = useState<FestaDraft>(() => {
    const prefill = typeof params.data === 'string' && parseDate(params.data) ? params.data : null;
    if (prefill) return { ...EMPTY_FESTA, date: prefill };
    return draftFor(drafts, account.id) ?? EMPTY_FESTA;
  });
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FestaErrors>({});
  const [note, setNote] = useState<{ text: string; tone: 'error' | 'muted' } | null>(null);
  const [sending, setSending] = useState(false);

  const times = festaTimes(draft);
  const monthKey = times ? partyMonthKey(times.startsAt) : undefined;
  const quota = useVenueQuota(account.id, monthKey);
  const genreLabel = useMemo(() => Object.fromEntries((genres.data ?? []).map((g) => [g.slug, g.label])), [genres.data]);

  const set = (patch: Partial<FestaDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
    if (Object.keys(errors).length) {
      const keys = Object.keys(patch);
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k) && !(k === 'date' && (keys.includes('start') || keys.includes('end'))))));
    }
  };

  const onContinue = () => {
    const e = validateFestaStep(step, draft);
    if (step === 1 && !e.date && !e.start && times && monthKey) {
      const used = quota.data?.month === monthKey ? quota.data.used : null;
      const code = submissionBlocker(account, times.startsAt, used);
      if (code === 'quota_exceeded' || code === 'beyond_paid_period' || code === 'starts_in_past') e.date = dateError(code, monthKey, account.plan.eventsPerMonth);
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => s + 1);
  };

  const onBack = () => {
    setErrors({});
    setNote(null);
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const onSaveDraft = () => {
    saveDraft(account.id, draft);
    setNote({ text: 'Rascunho salvo neste aparelho.', tone: 'muted' });
  };

  const onSend = async () => {
    if (!times) return setStep(1);
    setNote(null);
    setSending(true);
    try {
      let posterPath: string | null = null;
      if (draft.poster) {
        const up = await upload.mutateAsync({ accountId: account.id, file: draft.poster });
        if (!up.ok) {
          setStep(3);
          setNote({ text: up.error, tone: 'error' });
          return;
        }
        posterPath = up.path;
      }
      const res = await submit.mutateAsync({
        accountId: account.id,
        submission: {
          title: draft.title.trim(),
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          isFree: draft.free,
          priceMin: draft.free ? null : parseMoney(draft.priceMin),
          priceMax: draft.free || !draft.priceMax.trim() ? null : parseMoney(draft.priceMax),
          ticketUrl: draft.ticketUrl.trim() || null,
          ageMin: Number(draft.ageMin),
          genreSlugs: draft.genres,
          posterPath,
        },
      });
      if (!res.ok) {
        const back = ERROR_STEP[res.code];
        if (back) setStep(back);
        if (back === 1 && monthKey && (res.code === 'quota_exceeded' || res.code === 'beyond_paid_period' || res.code === 'starts_in_past')) {
          // The fix is on the date field; the footer says where to look.
          setErrors({ date: dateError(res.code, monthKey, account.plan.eventsPerMonth) });
          return;
        }
        setNote({ text: res.error, tone: 'error' });
        return;
      }
      clearDraft(account.id);
      router.replace('/casas/painel');
    } finally {
      setSending(false);
    }
  };

  const left = quota.data && monthKey ? Math.max(0, quota.data.limit - quota.data.used) : null;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <CasasShell
      title="Nova festa"
      onBack={onBack}
      testID="casas-festa-nova"
      footer={
        <>
          <Note tone={note?.tone ?? (hasErrors ? 'error' : 'muted')} text={note?.text ?? (hasErrors ? 'Confira os campos marcados.' : null)} testID="festa-nota" />
          {step < 4 ? (
            <Button label="Continuar" fullWidth onPress={onContinue} testID="festa-continuar" />
          ) : (
            <>
              <Button label="Enviar para revisão" fullWidth loading={sending} onPress={() => void onSend()} testID="festa-enviar" />
              <Button label="Salvar rascunho" variant="ghost" fullWidth disabled={sending} onPress={onSaveDraft} testID="festa-rascunho" />
            </>
          )}
        </>
      }>
      <StepBar step={step} total={4} label={STEPS[step - 1]} />

      {step === 1 ? (
        <>
          <Text variant="headline" accessibilityRole="header">
            Quando e estilo
          </Text>
          <TextField label="Nome da festa" value={draft.title} onChangeText={(t) => set({ title: t })} maxLength={120} error={errors.title} testID="festa-nome" />
          <TextField
            label="Data"
            mono
            value={draft.date}
            onChangeText={(t) => set({ date: maskDate(t) })}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="DD/MM/AAAA"
            hint="A festa conta na cota do mês dessa data."
            error={errors.date}
            testID="festa-data"
          />
          <View style={styles.pair}>
            <TextField
              label="Início"
              mono
              value={draft.start}
              onChangeText={(t) => set({ start: maskTime(t) })}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="23:00"
              error={errors.start}
              style={styles.flex}
              testID="festa-inicio"
            />
            <TextField
              label="Fim (opcional)"
              mono
              value={draft.end}
              onChangeText={(t) => set({ end: maskTime(t) })}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="05:00"
              error={errors.end}
              style={styles.flex}
              testID="festa-fim"
            />
          </View>
          <Caption style={casasStyles.section}>{`ESTILOS (ATÉ ${MAX_GENRES})`}</Caption>
          {genres.isPending ? (
            <Skeleton height={44} radius={22} />
          ) : (
            <View style={casasStyles.wrapChips}>
              {(genres.data ?? []).map((g) => {
                const selected = draft.genres.includes(g.slug);
                return (
                  <Chip
                    key={g.slug}
                    label={g.label}
                    selected={selected}
                    disabled={!selected && draft.genres.length >= MAX_GENRES}
                    onPress={() => set({ genres: selected ? draft.genres.filter((x) => x !== g.slug) : [...draft.genres, g.slug] })}
                    testID={`festa-genero-${g.slug}`}
                  />
                );
              })}
            </View>
          )}
          <Note tone="error" text={errors.genres} testID="festa-generos-erro" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text variant="headline" accessibilityRole="header">
            Preço e ingresso
          </Text>
          <Switch label="Grátis" value={draft.free} onValueChange={(v) => set({ free: v })} testID="festa-gratis" />
          {!draft.free ? (
            <View style={styles.pair}>
              <TextField
                label="Preço mínimo (R$)"
                mono
                value={draft.priceMin}
                onChangeText={(t) => set({ priceMin: t.replace(/[^0-9,]/g, '') })}
                keyboardType="decimal-pad"
                placeholder="30"
                error={errors.priceMin}
                style={styles.flex}
                testID="festa-preco-min"
              />
              <TextField
                label="Preço máximo (R$)"
                mono
                value={draft.priceMax}
                onChangeText={(t) => set({ priceMax: t.replace(/[^0-9,]/g, '') })}
                keyboardType="decimal-pad"
                placeholder="60"
                hint="Opcional"
                error={errors.priceMax}
                style={styles.flex}
                testID="festa-preco-max"
              />
            </View>
          ) : null}
          <TextField
            label="Link do ingresso"
            value={draft.ticketUrl}
            onChangeText={(t) => set({ ticketUrl: t })}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://"
            hint="Opcional. O Qual a boa? não vende ingressos: o link leva pro seu site."
            error={errors.ticketUrl}
            testID="festa-link"
          />
          <TextField
            label="Idade mínima"
            mono
            value={draft.ageMin}
            onChangeText={(t) => set({ ageMin: t.replace(/\D/g, '').slice(0, 2) })}
            keyboardType="number-pad"
            maxLength={2}
            hint="De 18 a 21 anos."
            error={errors.ageMin}
            testID="festa-idade"
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text variant="headline" accessibilityRole="header">
            Line-up e cartaz
          </Text>
          <Caption>LINE-UP</Caption>
          <LineupStep draft={draft} set={set} />
          <Caption style={casasStyles.section}>CARTAZ</Caption>
          <PosterStep draft={draft} set={set} />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Text variant="headline" accessibilityRole="header">
            Revisão
          </Text>
          <EventCard
            title={draft.title.trim()}
            venueName={accountVenueName(account)}
            area={account.venue?.area}
            priceLabel={draftPriceLabel(draft)}
            dateLabel={draftDateLabel(draft)}
            coverKey={coverFor({ genreSlugs: draft.genres, venueSlug: account.venue?.slug ?? '', eventId: draft.title })}
            imageUrl={draft.poster?.uri}
            testID="festa-previa"
          />
          <Card>
            <SummaryRow label="Estilos" value={draft.genres.map((g) => genreLabel[g] ?? g).join(', ')} />
            <SummaryRow label="Horário" value={draft.end.trim() ? `${draft.start} às ${draft.end}` : `a partir de ${draft.start}`} mono />
            <SummaryRow label="Idade mínima" value={`${draft.ageMin} anos`} mono />
            {draft.lineup.length ? <SummaryRow label="Line-up" value={draft.lineup.join(', ')} /> : null}
            <SummaryRow label="Ingresso" value={draft.ticketUrl.trim() || 'Sem link'} divider={false} />
          </Card>
          {left !== null && monthKey ? (
            <Text variant="body" testID="festa-aviso-cota">
              {`Vai usar 1 das ${left} festas que restam em ${monthName(monthKey)}. Se a revisão recusar, a vaga volta.`}
            </Text>
          ) : null}
        </>
      ) : null}
    </CasasShell>
  );
}

/** /casas/festa/nova: 4-step festa form; submit_event on the last step. */
export function NovaFestaScreen() {
  const router = useRouter();
  const { query, loading, failed, account } = useCurrentAccount();

  if (loading) {
    return (
      <CasasShell title="Nova festa" onBack={() => router.back()} testID="casas-festa-nova">
        <Skeleton height={48} radius={16} />
        <Skeleton height={48} radius={16} />
      </CasasShell>
    );
  }
  if (failed) {
    return (
      <CasasShell title="Nova festa" onBack={() => router.back()} testID="casas-festa-nova">
        <ErrorState inline message="Não foi possível carregar sua casa." onRetry={() => void query.refetch()} />
      </CasasShell>
    );
  }
  const blocked = !account
    ? 'Assine o Plano Casa para cadastrar festas.'
    : account.status === 'pending'
      ? 'A gente ainda está conferindo sua casa. Você pode cadastrar festas assim que terminar.'
      : !account.canSubmit
        ? casasErrorMessage(account.status === 'rejected' ? 'account_rejected' : !account.venue ? 'venue_missing' : 'subscription_inactive')
        : null;
  if (!account || blocked) {
    return (
      <CasasShell title="Nova festa" onBack={() => router.back()} testID="casas-festa-nova">
        <EmptyState
          title="Ainda não dá pra cadastrar"
          message={blocked ?? undefined}
          actionLabel={account ? 'Ir para o painel' : 'Ver o plano'}
          onAction={() => router.replace(account ? '/casas/painel' : '/casas')}
        />
      </CasasShell>
    );
  }
  return <Form key={account.id} account={account} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 140 },
  pair: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
});
