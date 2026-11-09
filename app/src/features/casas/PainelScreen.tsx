import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccountEvents } from '@/data/casas';
import { casasErrorMessage, partyMonthKey, submissionBlocker, type VenueAccount, type VenueEvent } from '@/domain/casas';
import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Badge, Button, Chip, EmptyState, ErrorState, ListRow, SegmentedControl, Skeleton, Text } from '@/ui';
import { accountVenueName, FESTA_BADGE, firstFridayOf, monthName, SUBSCRIPTION_BADGE } from './format';
import { Caption, CasasShell, Note, PastDueAlert, QuotaMeter, casasStyles } from './parts';
import { useCasasFlow, useCurrentAccount } from './store';

type Which = 'atual' | 'proximo';

/** Why the casa cannot submit at all right now (not month-specific), or null. */
function accountBlocker(a: VenueAccount): string | null {
  if (a.status === 'rejected') return casasErrorMessage('account_rejected');
  if (a.status === 'pending') return 'A gente ainda está conferindo sua casa. Você pode cadastrar festas assim que terminar.';
  if (!a.venue) return casasErrorMessage('venue_missing');
  if (!a.canSubmit) return casasErrorMessage('subscription_inactive');
  return null;
}

function FestaRow({ ev, divider }: { ev: VenueEvent; divider: boolean }) {
  const { colors } = useTheme();
  const badge = FESTA_BADGE[ev.status];
  return (
    <View
      style={[styles.festa, divider && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
      testID={`casas-festa-${ev.id}`}>
      <View style={styles.festaHead}>
        <Text variant="body" style={styles.flex} numberOfLines={2}>
          {ev.title}
        </Text>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <Text variant="mono" tone="textMuted">
        {`${formatEventDate(ev.startsAt)} · ${formatPriceLabel(ev.priceMin, ev.priceMax, ev.isFree)}`}
      </Text>
      {ev.status === 'rejected' ? (
        <Text variant="bodySm" tone="textMuted">
          {`${ev.reviewNote ? `${ev.reviewNote}. ` : ''}Não conta na cota.`}
        </Text>
      ) : null}
    </View>
  );
}

/** /casas/painel: casa header, month quota meter, festas of the month and the "Cadastrar festa" CTA. */
export function PainelScreen() {
  const router = useRouter();
  const { query, loading, failed, accounts, account } = useCurrentAccount();
  const selectAccount = useCasasFlow((s) => s.selectAccount);
  const events = useAccountEvents(account?.id);
  const [which, setWhich] = useState<Which>('atual');

  const quota = account ? (which === 'atual' ? account.currentMonth : account.nextMonth) : null;
  const monthEvents = useMemo(
    () =>
      quota
        ? (events.data ?? []).filter((e) => partyMonthKey(e.startsAt) === quota.month).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        : [],
    [events.data, quota],
  );

  if (loading) {
    return (
      <CasasShell title="Painel da casa" onBack={() => router.back()} testID="casas-painel">
        <View style={casasStyles.gap} testID="casas-painel-loading">
          <Skeleton height={32} width={220} radius={14} />
          <Skeleton height={48} radius={16} />
          <Skeleton height={96} radius={24} />
          <Skeleton height={88} radius={14} />
        </View>
      </CasasShell>
    );
  }
  if (failed) {
    return (
      <CasasShell title="Painel da casa" onBack={() => router.back()} testID="casas-painel">
        <ErrorState inline message="Não foi possível carregar o painel." onRetry={() => void query.refetch()} />
      </CasasShell>
    );
  }
  if (!account || !quota) {
    return (
      <CasasShell title="Painel da casa" onBack={() => router.back()} testID="casas-painel">
        <EmptyState title="Você ainda não tem uma casa" message="Assine o Plano Casa para cadastrar suas festas." actionLabel="Ver o plano" onAction={() => router.replace('/casas')} />
      </CasasShell>
    );
  }

  const cur = account.currentMonth;
  const next = account.nextMonth;
  const month = monthName(quota.month);
  const left = Math.max(0, quota.limit - quota.used);
  const full = left === 0;
  const blocked = accountBlocker(account);
  // Month-level check (paid period) with a festa in the middle of the selected month.
  const probe = new Date(Date.parse(`${quota.month}-15T23:00:00-03:00`)).toISOString();
  const periodCode = !blocked ? submissionBlocker(account, probe, quota.used) : null;
  const beyond = periodCode === 'beyond_paid_period';
  const nextHasRoom = which === 'atual' && next.used < next.limit;
  const sub = account.subscription;

  const goNew = (monthKey?: string) =>
    router.push(monthKey ? { pathname: '/casas/festa/nova', params: { data: firstFridayOf(monthKey) } } : '/casas/festa/nova');

  let footerNote: string | null = blocked;
  if (!blocked && beyond) footerNote = casasErrorMessage('beyond_paid_period');
  else if (!blocked && full) {
    footerNote =
      which === 'atual'
        ? `Você já usou as ${quota.limit} festas de ${month}. ${monthName(next.month)} libera no dia 1º.`
        : `Você já usou as ${quota.limit} festas de ${month}.`;
  }
  const canCreate = !blocked && !beyond && !full;

  return (
    <CasasShell
      title="Painel da casa"
      onBack={() => router.back()}
      testID="casas-painel"
      footer={
        <>
          <Note text={footerNote} testID="casas-painel-nota" />
          {!blocked && full && nextHasRoom ? (
            <Button label={`Cadastrar para ${monthName(next.month)}`} variant="secondary" fullWidth onPress={() => goNew(next.month)} testID="casas-cadastrar-proximo" />
          ) : null}
          <Button
            label="Cadastrar festa"
            icon="plus"
            fullWidth
            disabled={!canCreate}
            onPress={() => goNew(which === 'proximo' ? quota.month : undefined)}
            testID="casas-cadastrar-festa"
          />
        </>
      }>
      {accounts.length > 1 ? (
        <View style={casasStyles.wrapChips} accessibilityLabel="Suas casas">
          {accounts.map((a) => (
            <Chip key={a.id} label={accountVenueName(a)} selected={a.id === account.id} onPress={() => selectAccount(a.id)} testID={`casas-conta-${a.id}`} />
          ))}
        </View>
      ) : null}

      <View style={styles.head}>
        <Text variant="headline" accessibilityRole="header" testID="casas-painel-nome">
          {accountVenueName(account)}
        </Text>
        <View style={casasStyles.row}>
          {sub ? (
            <Badge label={SUBSCRIPTION_BADGE[sub.status].label} tone={SUBSCRIPTION_BADGE[sub.status].tone} />
          ) : (
            <Badge label="Sem assinatura" tone="neutral" />
          )}
          {account.status === 'pending' ? <Badge label="Verificando sua casa" tone="neutral" icon="clock" /> : null}
          {account.status === 'rejected' ? <Badge label="Casa não aprovada" tone="danger" /> : null}
        </View>
        {account.status === 'rejected' && account.reviewNote ? (
          <Text variant="bodySm" tone="textMuted">
            {account.reviewNote}
          </Text>
        ) : null}
      </View>

      {sub?.status === 'past_due' ? <PastDueAlert periodEnd={sub.currentPeriodEnd} /> : null}

      <SegmentedControl<Which>
        label="Mês das festas"
        value={which}
        onChange={setWhich}
        options={[
          { value: 'atual', label: monthName(cur.month) },
          { value: 'proximo', label: monthName(next.month) },
        ]}
      />

      <QuotaMeter used={quota.used} limit={quota.limit} testID="casas-cota" />
      <Text variant="bodySm" tone="textMuted" testID="casas-sobram">
        {left === 1 ? `Sobra 1 em ${month}` : `Sobram ${left} em ${month}`}
      </Text>

      <Caption style={casasStyles.section}>{`FESTAS DE ${month.toUpperCase()}`}</Caption>
      {events.isPending ? (
        <Skeleton height={88} radius={14} />
      ) : events.isError ? (
        <ErrorState inline message="Não foi possível carregar as festas." onRetry={() => void events.refetch()} />
      ) : monthEvents.length ? (
        <View>
          {monthEvents.map((ev, i) => (
            <FestaRow key={ev.id} ev={ev} divider={i < monthEvents.length - 1} />
          ))}
        </View>
      ) : (
        <Text variant="body" tone="textMuted" testID="casas-sem-festas">
          {`Nenhuma festa em ${month} ainda.`}
        </Text>
      )}

      <ListRow
        title="Assinatura"
        subtitle={sub ? SUBSCRIPTION_BADGE[sub.status].label : 'Sem assinatura'}
        icon="star"
        chevron
        onPress={() => router.push('/casas/assinatura')}
        style={casasStyles.section}
        testID="casas-painel-assinatura-row"
      />
    </CasasShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: space.sm },
  festa: { gap: space.xs, paddingVertical: space.md, minHeight: 88, justifyContent: 'center' },
  festaHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
