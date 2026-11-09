import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { useClaimVenue, useStartCheckout } from '@/data/casas';
import { formatPlanPrice, PLAN, type CasasErrorCode } from '@/domain/casas';
import { formatBRL } from '@/domain/format';
import { Button, Text } from '@/ui';
import { fullDate, nextChargeDate, whatsappE164 } from './format';
import { openStripePage } from './openUrl';
import { Card, CasasShell, Note, StepBar, SummaryRow } from './parts';
import { useCasasFlow } from './store';

/** Where the fix for each claim/checkout error lives. */
const FIX: Partial<Record<CasasErrorCode, { label: string; href: '/casas/vincular' | '/casas/vincular/empresa' | '/casas/painel' }>> = {
  cnpj_taken: { label: 'Corrigir CNPJ', href: '/casas/vincular/empresa' },
  invalid_cnpj: { label: 'Corrigir CNPJ', href: '/casas/vincular/empresa' },
  invalid_payload: { label: 'Revisar dados', href: '/casas/vincular/empresa' },
  venue_taken: { label: 'Escolher outra casa', href: '/casas/vincular' },
  venue_not_found: { label: 'Escolher outra casa', href: '/casas/vincular' },
  already_subscribed: { label: 'Abrir painel', href: '/casas/painel' },
};

/** /casas/vincular/pagamento (3/3): summary, then claim_venue (once) and Stripe Checkout in the browser. */
export function PagamentoScreen() {
  const router = useRouter();
  const venue = useCasasFlow((s) => s.venue);
  const company = useCasasFlow((s) => s.company);
  const claimedId = useCasasFlow((s) => s.claimedId);
  const setClaimed = useCasasFlow((s) => s.setClaimed);
  const claim = useClaimVenue();
  const checkout = useStartCheckout();
  const [error, setError] = useState<{ code: CasasErrorCode; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!venue) return <Redirect href="/casas/vincular" />;
  if (!company.cnpj) return <Redirect href="/casas/vincular/empresa" />;

  const venueName = venue.kind === 'catalog' ? venue.name : venue.proposed.name;

  const onPay = async () => {
    setError(null);
    setBusy(true);
    try {
      let accountId = claimedId;
      if (!accountId) {
        const res = await claim.mutateAsync({
          venueId: venue.kind === 'catalog' ? venue.id : null,
          proposed: venue.kind === 'new' ? venue.proposed : null,
          cnpj: company.cnpj,
          legalName: company.legalName,
          contactName: company.contactName,
          whatsapp: whatsappE164(company.whatsapp),
          venueLabel: venue.kind === 'catalog' ? { name: venue.name, area: venue.area } : undefined,
        });
        if (!res.ok) {
          setError({ code: res.code, text: res.error });
          return;
        }
        accountId = res.accountId;
        setClaimed(accountId);
      }
      const res = await checkout.mutateAsync(accountId);
      if (!res.ok) {
        setError({ code: res.code, text: res.error });
        return;
      }
      if (res.url === null) {
        // Demonstration build: no Stripe, the subscription is already active.
        router.replace('/casas/assinatura?status=sucesso');
        return;
      }
      const how = await openStripePage(res.url);
      if (how === 'closed') router.replace('/casas/assinatura?status=sucesso');
    } finally {
      setBusy(false);
    }
  };

  const fix = error ? FIX[error.code] : undefined;

  return (
    <CasasShell
      title="Vincular casa"
      onBack={() => router.back()}
      testID="casas-pagamento"
      footer={
        <>
          <Note tone="error" text={error?.text} testID="casas-pagamento-erro" />
          {fix ? <Button label={fix.label} variant="secondary" fullWidth onPress={() => router.replace(fix.href)} testID="casas-pagamento-fix" /> : null}
          <Button label="Ir para o pagamento" fullWidth loading={busy} onPress={onPay} testID="casas-pagar" />
        </>
      }>
      <StepBar step={3} total={3} label="Pagamento" />
      <Text variant="headline" accessibilityRole="header">
        Confira e assine
      </Text>
      <Card testID="casas-resumo">
        <SummaryRow label="Casa" value={venueName} />
        <SummaryRow label="CNPJ" value={company.cnpj} mono />
        <SummaryRow label="Responsável" value={company.contactName} />
        <SummaryRow label="Plano" value={`Plano Casa · ${PLAN.eventsPerMonth} festas por mês`} />
        <SummaryRow label="Valor" value={`${formatBRL(PLAN.priceCents / 100)}/mês`} mono />
        <SummaryRow label="Próxima cobrança" value={fullDate(nextChargeDate())} mono divider={false} />
      </Card>
      <Text variant="bodySm" tone="textMuted">
        {`Você termina o pagamento no navegador, numa página segura da Stripe. Hoje é cobrado ${formatPlanPrice()}; depois, todo mês no mesmo dia. Pode cancelar quando quiser.`}
      </Text>
      <Text variant="bodySm" tone="textMuted">
        Depois do pagamento a gente confere se a casa é sua. Enquanto isso, você já vê o painel.
      </Text>
    </CasasShell>
  );
}
