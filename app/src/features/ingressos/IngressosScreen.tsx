import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatBRL, formatEventDate, formatPriceLabel } from '@/domain/format';
import { useEvent } from '@/data/queries';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { isHttpsUrl, ticketHost } from '@/features/evento/linking';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Button, Cover, IconButton, Text, useBreakpoint } from '@/ui';
import { useInsets } from '@/ui/useInsets';

export const QTY_MIN = 1;
export const QTY_MAX = 10;

/** "Estimativa" text for `qty` tickets, or null when there is no price to multiply. */
export function estimateLabel(qty: number, priceMin: number | null, priceMax: number | null, isFree: boolean): string | null {
  if (isFree || priceMin == null) return null;
  const lo = qty * Math.min(priceMin, priceMax ?? priceMin);
  const hi = qty * Math.max(priceMin, priceMax ?? priceMin);
  return lo === hi ? formatBRL(lo) : `${formatBRL(lo)} a ${formatBRL(hi)}`;
}

function Note({ title, children }: { title: string; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="body" style={styles.bold}>
        {title}
      </Text>
      <Text variant="bodySm" tone="textMuted">
        {children}
      </Text>
    </View>
  );
}

/**
 * Ingressos: the step before leaving the app. Shows the price as published, a quantity estimate, the meia-entrada
 * rule and exactly which site will finish the purchase. The app does not sell tickets.
 */
export function IngressosScreen({ id }: { id?: string }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const insets = useInsets();
  const goBack = useGoBack();
  const { location } = useLocation();
  const q = useEvent(id, location);
  const [qty, setQty] = useState(2);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Ele pode ter sido removido. Volte e veja o que está rolando hoje.' }} />;
  }

  const { event, venue } = q.data;
  const cancelled = event.status === 'cancelled';
  const host = ticketHost(event.ticketUrl);
  const canBuy = !cancelled && isHttpsUrl(event.ticketUrl) && !!host;
  const price = formatPriceLabel(event.priceMin, event.priceMax, event.isFree);
  const variable = !event.isFree && event.priceMin != null && event.priceMax != null && event.priceMin !== event.priceMax;
  const estimate = estimateLabel(qty, event.priceMin, event.priceMax, event.isFree);
  const buy = () => {
    if (canBuy) WebBrowser.openBrowserAsync(event.ticketUrl!.trim()).catch(() => undefined);
  };

  return (
    <Frame
      footer={
        <View style={styles.footer}>
          {estimate ? (
            <View style={styles.total}>
              <Text variant="caption" tone="textMuted">
                {qty} {qty === 1 ? 'ingresso' : 'ingressos'}, estimativa
              </Text>
              <Text variant="mono" style={styles.totalValue} testID="ingressos-estimate">
                {estimate}
              </Text>
            </View>
          ) : null}
          <Button
            label={canBuy ? `Continuar em ${host}` : cancelled ? 'Evento cancelado' : 'Ingressos indisponíveis'}
            disabled={!canBuy}
            onPress={buy}
            accessibilityHint={canBuy ? `Abre ${host} no navegador para concluir a compra` : undefined}
            style={styles.grow}
            testID="ingressos-continue"
          />
        </View>
      }>
      <View style={[styles.body, { paddingHorizontal: gutter, paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerRow}>
          <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={goBack} />
          <Text variant="headline" accessibilityRole="header">
            Ingressos
          </Text>
        </View>

        <View style={[styles.event, { backgroundColor: colors.surface }]}>
          <Cover coverKey={event.coverKey} imageUrl={event.imageUrl} style={styles.cover} />
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={2}>
              {event.title}
            </Text>
            <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
              {venue.name} · {venue.area}
            </Text>
            <Text variant="mono">{formatEventDate(event.startsAt)}</Text>
          </View>
        </View>

        {cancelled ? <Badge label="Evento cancelado" tone="danger" icon="close" /> : null}

        <View style={styles.group}>
          <Text variant="caption" tone="textMuted" accessibilityRole="header">
            PREÇO PUBLICADO
          </Text>
          <Text variant="headline" testID="ingressos-price">
            {price}
          </Text>
          {variable ? (
            <Text variant="bodySm" tone="textMuted">
              O valor muda conforme o lote ou o setor. As opções aparecem no site da bilheteria.
            </Text>
          ) : null}
        </View>

        {estimate ? (
          <View style={[styles.qtyRow, { borderColor: colors.border }]}>
            <Text variant="body" style={styles.flex}>
              Quantidade
            </Text>
            <IconButton icon="chevronLeft" label="Menos um ingresso" variant="filled" disabled={qty <= QTY_MIN} onPress={() => setQty((n) => Math.max(QTY_MIN, n - 1))} />
            <Text variant="mono" accessibilityLabel={`${qty} ingressos`} accessibilityLiveRegion="polite" style={styles.qty} testID="ingressos-qty">
              {qty}
            </Text>
            <IconButton icon="chevronRight" label="Mais um ingresso" variant="filled" disabled={qty >= QTY_MAX} onPress={() => setQty((n) => Math.min(QTY_MAX, n + 1))} />
          </View>
        ) : null}

        {canBuy ? (
          <Note title={`A compra termina em ${host}`}>
            O Qual a boa? não vende ingressos. Você escolhe o lote e paga no site da bilheteria, onde aparecem taxas, se houver, antes do pagamento.
          </Note>
        ) : !cancelled ? (
          <Note title="Sem link de venda">Este evento ainda não tem bilheteria online. Confira com a casa como comprar na porta.</Note>
        ) : null}
        {!event.isFree ? (
          <Note title="Meia-entrada">
            Têm direito, com documento: estudantes, pessoas com deficiência, jovens de baixa renda (ID Jovem) e pessoas com 60 anos ou mais.
          </Note>
        ) : null}
        {event.ageMin >= 18 ? (
          <Text variant="bodySm" tone="textMuted">
            Proibido para menores de 18 anos. Leve documento com foto.
          </Text>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1 },
  bold: { fontWeight: '600' },
  body: { gap: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  event: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, alignItems: 'center' },
  cover: { width: 72, height: 72, borderRadius: 14 },
  group: { gap: space.xs },
  qtyRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderBottomWidth: 1 },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 17 },
  note: { gap: space.xs, padding: space.lg, borderRadius: radius.md, borderWidth: 1 },
  footer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { gap: 2 },
  totalValue: { fontSize: 18 },
});
