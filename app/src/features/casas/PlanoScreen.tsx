import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAccountEmail } from '@/data/auth';
import { isRemote } from '@/data/supabaseClient';
import { formatPlanPrice, PLAN } from '@/domain/casas';
import { fonts, space, type } from '@/theme/tokens';
import { Button, ListRow, Text } from '@/ui';
import { accountVenueName } from './format';
import { Caption, Card, CasasShell, CheckLine, casasStyles } from './parts';
import { useCurrentAccount } from './store';

const PRICE = formatPlanPrice(PLAN.priceCents);

const FEATURES = [
  `${PLAN.eventsPerMonth} festas por mês, contadas pelo mês da festa`,
  'Aparece no Início, no Mapa e na Busca',
  'Painel com o status de cada festa',
  'Link direto pro seu ingresso',
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Como funciona a revisão?',
    a: 'Primeiro a gente confere se a casa é sua (CNPJ e responsável). Depois, cada festa enviada passa por uma revisão rápida antes de aparecer no app. A gente te avisa por e-mail.',
  },
  {
    q: 'O que conta na cota?',
    a: `Cada festa usa 1 das ${PLAN.eventsPerMonth} vagas do mês em que ela acontece, não do mês em que você cadastrou. Festa recusada não conta: a vaga volta.`,
  },
  {
    q: 'Como cancelo?',
    a: 'Na tela da assinatura, a qualquer momento. O plano vale até o fim do mês pago e as festas já publicadas continuam no app.',
  },
];

/** /casas: the single plan card, FAQ and the sticky "Assinar" CTA (login first). */
export function PlanoScreen() {
  const router = useRouter();
  const email = useAccountEmail();
  const { account } = useCurrentAccount();

  const onSubscribe = () => {
    if (isRemote() && !email) {
      router.push({ pathname: '/entrar', params: { next: '/casas/vincular' } });
      return;
    }
    router.push('/casas/vincular');
  };

  return (
    <CasasShell
      title="Plano Casa"
      onBack={() => router.back()}
      testID="casas-plano"
      footer={<Button label={`Assinar por ${PRICE}/mês`} fullWidth onPress={onSubscribe} testID="casas-assinar" />}>
      <View style={styles.hero}>
        <Caption>PARA CASAS NOTURNAS</Caption>
        <Text variant="display" accessibilityRole="header">
          Sua festa no Qual a boa?
        </Text>
        <Text variant="body" tone="textMuted">
          Cadastre as festas da sua casa e apareça para quem está decidindo onde ir hoje.
        </Text>
      </View>

      {account ? (
        <ListRow
          title={`Painel da ${accountVenueName(account)}`}
          subtitle="Você já tem uma casa cadastrada"
          icon="spark"
          chevron
          onPress={() => router.push('/casas/painel')}
          testID="casas-atalho-painel"
        />
      ) : null}

      <Card testID="casas-plano-card">
        <Text variant="title" accessibilityRole="header">
          Plano Casa
        </Text>
        <View style={styles.priceRow} accessible accessibilityLabel={`${PRICE} por mês`}>
          <Text style={styles.price} testID="casas-preco">
            {PRICE}
          </Text>
          <Text variant="body" tone="textMuted">
            /mês
          </Text>
        </View>
        <View style={casasStyles.gap}>
          {FEATURES.map((f) => (
            <CheckLine key={f}>{f}</CheckLine>
          ))}
        </View>
        <Text variant="bodySm" tone="textMuted">
          Cobrança mensal no cartão. Cancele quando quiser: vale até o fim do mês pago. O Qual a boa? não vende ingressos.
        </Text>
      </Card>

      <Caption style={casasStyles.section}>PERGUNTAS FREQUENTES</Caption>
      {FAQ.map((item) => (
        <View key={item.q} style={styles.faq}>
          <Text variant="body" style={styles.q} accessibilityRole="header">
            {item.q}
          </Text>
          <Text variant="bodySm" tone="textMuted">
            {item.a}
          </Text>
        </View>
      ))}
    </CasasShell>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, marginTop: space.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  price: { fontFamily: fonts.mono, fontSize: type.display.fontSize, lineHeight: type.display.lineHeight },
  faq: { gap: space.xs },
  q: { fontFamily: fonts.bodySemi },
});
