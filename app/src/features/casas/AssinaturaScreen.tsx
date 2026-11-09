import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { casasKeys, useOpenBillingPortal } from '@/data/casas';
import { formatPlanPrice, type VenueAccount } from '@/domain/casas';
import { space } from '@/theme/tokens';
import { Badge, Button, EmptyState, ErrorState, Sheet, Skeleton, Text } from '@/ui';
import { accountVenueName, dayMonth, fullDate, SUBSCRIPTION_BADGE } from './format';
import { openStripePage } from './openUrl';
import { Card, CasasShell, Note, PastDueAlert, SummaryRow, casasStyles } from './parts';
import { useCurrentAccount } from './store';

export const POLL_MS = 3000;
export const POLL_MAX = 20;

const isLive = (a: VenueAccount | null) => a?.subscription?.status === 'active' || a?.subscription?.status === 'past_due';

function Loading() {
  return (
    <View style={casasStyles.gap} testID="casas-assinatura-loading">
      <Skeleton height={28} width={180} radius={14} />
      <Skeleton height={160} radius={24} />
    </View>
  );
}

/** Return from Stripe Checkout: wait for the webhook to flip the subscription, then the next step. */
function Confirmation({ account, status }: { account: VenueAccount | null; status: 'sucesso' | 'cancelado' }) {
  const router = useRouter();
  const qc = useQueryClient();
  const live = isLive(account);
  const [timedOut, setTimedOut] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (status !== 'sucesso' || live) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > POLL_MAX) {
        clearInterval(t);
        setTimedOut(true);
        return;
      }
      void qc.invalidateQueries({ queryKey: casasKeys.accounts });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [status, live, qc, round]);

  if (status === 'cancelado') {
    return (
      <View style={casasStyles.gap} testID="casas-assinatura-cancelado">
        <Text variant="headline" accessibilityRole="header">
          Pagamento não concluído
        </Text>
        <Text variant="body" tone="textMuted">
          Nada foi cobrado. Você pode tentar de novo quando quiser.
        </Text>
        <Button label="Tentar de novo" fullWidth onPress={() => router.replace('/casas/vincular/pagamento')} testID="casas-tentar-de-novo" />
        <Button label="Voltar ao plano" variant="ghost" fullWidth onPress={() => router.replace('/casas')} />
      </View>
    );
  }

  if (!live) {
    return (
      <View style={casasStyles.gap} testID="casas-confirmando">
        <Text variant="headline" accessibilityRole="header">
          Confirmando pagamento
        </Text>
        {timedOut ? (
          <>
            <Text variant="body" tone="textMuted" accessibilityLiveRegion="polite">
              Ainda não recebemos a confirmação da Stripe. Se você concluiu o pagamento, ela chega em instantes.
            </Text>
            <Button
              label="Ver de novo"
              variant="secondary"
              fullWidth
              onPress={() => {
                setTimedOut(false);
                setRound((r) => r + 1);
                void qc.invalidateQueries({ queryKey: casasKeys.accounts });
              }}
              testID="casas-confirmar-de-novo"
            />
          </>
        ) : (
          <>
            <Text variant="body" tone="textMuted">
              Isso leva alguns segundos.
            </Text>
            <Skeleton height={28} width={160} radius={14} />
            <Skeleton height={96} radius={24} />
          </>
        )}
      </View>
    );
  }

  const verifying = account!.status === 'pending';
  return (
    <View style={casasStyles.gap} testID="casas-assinatura-ativa">
      <Text variant="headline" accessibilityRole="header">
        Tudo certo com o pagamento
      </Text>
      <View style={casasStyles.row}>
        <Badge label="Assinatura ativa" tone="success" icon="check" />
        {verifying ? <Badge label="Verificando sua casa" tone="neutral" icon="clock" /> : null}
      </View>
      {verifying ? (
        <Text variant="body" tone="textMuted" testID="casas-verificando">
          {`Agora a gente confere se a ${accountVenueName(account!)} é sua. A gente te avisa por e-mail quando terminar.`}
        </Text>
      ) : null}
      {account!.status === 'verified' ? (
        <Button label="Cadastrar primeira festa" fullWidth onPress={() => router.replace('/casas/festa/nova')} testID="casas-primeira-festa" />
      ) : (
        <Button label="Ir para o painel" fullWidth onPress={() => router.replace('/casas/painel')} testID="casas-ir-painel" />
      )}
    </View>
  );
}

/** Gerenciar: status, price, next charge, card (Stripe portal) and cancel. */
function Manage({ account }: { account: VenueAccount }) {
  const router = useRouter();
  const portal = useOpenBillingPortal();
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'error' | 'muted' } | null>(null);
  const sub = account.subscription;

  if (!sub) {
    return (
      <EmptyState
        title="Sua casa ainda não tem assinatura"
        message={`Assine o Plano Casa por ${formatPlanPrice()}/mês para cadastrar festas.`}
        actionLabel="Ver o plano"
        onAction={() => router.push('/casas')}
      />
    );
  }

  const openPortal = async () => {
    setNote(null);
    const res = await portal.mutateAsync(account.id);
    if (!res.ok) {
      setNote({ text: res.error, tone: 'error' });
      return false;
    }
    if (res.url === null) {
      setNote({ text: 'O portal de pagamento não está disponível nesta versão do app.', tone: 'muted' });
      return false;
    }
    await openStripePage(res.url);
    return true;
  };

  const end = sub.currentPeriodEnd;
  const badge = sub.cancelAtPeriodEnd && sub.status === 'active' ? { label: 'Termina no fim do período', tone: 'neutral' as const } : SUBSCRIPTION_BADGE[sub.status];
  const ended = sub.status === 'canceled';

  return (
    <View style={casasStyles.gap} testID="casas-gerenciar">
      <Text variant="headline" accessibilityRole="header">
        {accountVenueName(account)}
      </Text>
      <View style={casasStyles.row}>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      {sub.status === 'past_due' ? <PastDueAlert periodEnd={end} /> : null}
      <Card>
        <SummaryRow label="Plano" value={`Plano Casa · ${account.plan.eventsPerMonth} festas por mês`} />
        <SummaryRow label="Valor" value={`${formatPlanPrice(account.plan.priceCents)}/mês`} mono />
        {end ? (
          <SummaryRow
            label={ended ? 'Terminou em' : sub.cancelAtPeriodEnd ? 'Vale até' : 'Próxima cobrança'}
            value={fullDate(end)}
            mono
            divider={false}
          />
        ) : null}
      </Card>
      <Note text={note?.text} tone={note?.tone} testID="casas-assinatura-note" />
      {ended ? (
        <Button label="Assinar de novo" fullWidth onPress={() => router.push('/casas')} />
      ) : (
        <>
          <Button label="Trocar cartão" variant="secondary" fullWidth loading={portal.isPending && !sheet} onPress={() => void openPortal()} testID="casas-trocar-cartao" />
          {!sub.cancelAtPeriodEnd ? (
            <Button label="Cancelar assinatura" variant="ghost" fullWidth onPress={() => setSheet(true)} testID="casas-cancelar" />
          ) : null}
        </>
      )}
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Cancelar assinatura?"
        testID="casas-cancelar-sheet"
        footer={
          <View style={styles.sheetFooter}>
            <Button
              label="Cancelar no fim do período"
              variant="secondary"
              fullWidth
              loading={portal.isPending}
              onPress={async () => {
                await openPortal();
                setSheet(false);
              }}
              testID="casas-cancelar-confirmar"
            />
            <Button label="Manter assinatura" fullWidth onPress={() => setSheet(false)} testID="casas-manter" />
          </View>
        }>
        <View style={casasStyles.gap}>
          <Text variant="body">As festas já publicadas continuam no app.</Text>
          <Text variant="body">
            {end ? `Depois de ${dayMonth(end)} não dá pra cadastrar festas novas.` : 'Depois do fim do período pago não dá pra cadastrar festas novas.'}
          </Text>
          <Text variant="bodySm" tone="textMuted">
            O cancelamento é feito na página segura da Stripe.
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

/** /casas/assinatura: Stripe return (?status=sucesso|cancelado) or manage the subscription. */
export function AssinaturaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const status = params.status === 'sucesso' || params.status === 'cancelado' ? params.status : null;
  const { query, loading, failed, account } = useCurrentAccount();

  return (
    <CasasShell
      title="Assinatura"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/casas/painel'))}
      testID="casas-assinatura">
      {loading ? (
        <Loading />
      ) : failed ? (
        <ErrorState inline message="Não foi possível carregar a assinatura." onRetry={() => void query.refetch()} />
      ) : status ? (
        <Confirmation account={account} status={status} />
      ) : account ? (
        <Manage account={account} />
      ) : (
        <EmptyState
          title="Nenhuma casa cadastrada"
          message="Vincule sua casa para assinar o plano."
          actionLabel="Ver o plano"
          onAction={() => router.replace('/casas')}
        />
      )}
    </CasasShell>
  );
}

const styles = StyleSheet.create({
  sheetFooter: { gap: space.sm },
});
