import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { authAvailable } from '@/data/auth';
import { useResetRecommendations } from '@/features/explorar/useTasteProfile';
import { AreaSheet } from '@/features/explorar/AreaSheet';
import { NARROW_MAX_WIDTH } from '@/features/layout';
import { LegalSheet } from '@/features/perfil/LegalSheet';
import { PRIVACY, TERMS, type LegalDoc } from '@/features/perfil/legalText';
import { OUTSIDE_PILOT_MESSAGE, openSettings } from '@/lib/location';
import { wipeLocalData } from '@/state/accountData';
import { useLocation } from '@/state/location';
import { useSearchHistory } from '@/state/searchHistory';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, ListRow, Screen, ScreenHeader, Sheet, Text } from '@/ui';

/** Plain-language status of the location permission and source. */
export function useLocationStatus(): string {
  const loc = useLocation();
  if (loc.permission === 'blocked') return 'Bloqueada nas configurações. Usando o bairro escolhido ou o ponto padrão';
  if (loc.outsidePilot) return OUTSIDE_PILOT_MESSAGE;
  if (loc.source === 'device') return `Só enquanto usa o app. Agora: ${loc.location.label}`;
  if (loc.source === 'area') return `Sem GPS. Bairro escolhido: ${loc.location.label}`;
  if (loc.permission === 'denied') return 'Permissão negada. Usando o ponto padrão';
  return `Não pedida. Usando o ponto padrão: ${loc.location.label}`;
}

function Caption({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="textMuted" accessibilityRole="header" style={styles.section}>
      {children}
    </Text>
  );
}

/** Privacidade e dados (LGPD): permissions, what stays on the device, clearing history, export/erase and the documents. */
export function PrivacidadeScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const { colors } = useTheme();
  const permission = useLocation((s) => s.permission);
  const locationStatus = useLocationStatus();
  const recentCount = useSearchHistory((s) => s.recent.length);
  const clearHistory = useSearchHistory((s) => s.clear);
  const resetReco = useResetRecommendations();
  const hasAccount = authAvailable();

  const [areaOpen, setAreaOpen] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const say = (msg: string) => setDone(msg);

  return (
    <Screen testID="privacidade-screen">
      <ScreenHeader title="Privacidade e dados" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="body" style={styles.bold}>
            O que fica só neste aparelho
          </Text>
          <Text variant="bodySm" tone="textMuted">
            Sua localização, as buscas recentes e o cálculo do seu gosto para recomendações. A localização nunca é enviada a um servidor.
          </Text>
        </View>

        <Caption>PERMISSÕES</Caption>
        <ListRow title="Localização" subtitle={locationStatus} icon="pin" divider testID="privacidade-location" />
        {permission === 'blocked' ? (
          <ListRow title="Abrir configurações" subtitle="Libere ou bloqueie a localização para o app" chevron divider onPress={() => openSettings()} />
        ) : (
          <ListRow title="Usar um bairro em vez do GPS" chevron divider onPress={() => setAreaOpen(true)} testID="privacidade-area" />
        )}
        <ListRow
          title="Avisos de eventos"
          subtitle="Você escolhe os avisos em cada evento que acompanha"
          icon="clock"
          chevron
          divider
          onPress={() => router.push('/acompanhar')}
          testID="privacidade-avisos"
        />

        <Caption>HISTÓRICO E RECOMENDAÇÕES</Caption>
        <ListRow
          title="Limpar buscas recentes"
          subtitle={recentCount ? `${recentCount} ${recentCount === 1 ? 'busca guardada' : 'buscas guardadas'}` : 'Nenhuma busca guardada'}
          icon="search"
          divider
          disabled={!recentCount}
          onPress={() => {
            clearHistory();
            say('Buscas recentes apagadas.');
          }}
          testID="privacidade-clear-history"
        />
        <ListRow
          title="Zerar recomendações"
          subtitle="Esquece o gosto calculado a partir dos seus salvos, avaliações e filtros"
          icon="star"
          divider
          onPress={() => {
            resetReco();
            say('Recomendações zeradas.');
          }}
          testID="privacidade-reset-reco"
        />

        <Caption>SEUS DADOS</Caption>
        {hasAccount ? (
          <ListRow
            title="Exportar ou apagar meus dados"
            subtitle="Baixe um arquivo com tudo ou apague a conta"
            icon="user"
            chevron
            divider
            onPress={() => router.push('/conta')}
            testID="privacidade-conta"
          />
        ) : (
          <ListRow
            title="Apagar dados deste aparelho"
            subtitle="Salvos, acompanhados, avaliações, mensagens e preferências"
            icon="close"
            chevron
            divider
            onPress={() => setWipeOpen(true)}
            testID="privacidade-wipe"
          />
        )}

        <Caption>DOCUMENTOS</Caption>
        <ListRow title="Política de privacidade" chevron divider onPress={() => setLegal(PRIVACY)} />
        <ListRow title="Termos de uso" chevron onPress={() => setLegal(TERMS)} />

        {done ? (
          <Text variant="bodySm" accessibilityLiveRegion="polite" testID="privacidade-done">
            {done}
          </Text>
        ) : null}
      </ScrollView>

      <AreaSheet visible={areaOpen} onClose={() => setAreaOpen(false)} />
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
      <Sheet visible={wipeOpen} onClose={() => setWipeOpen(false)} title="Apagar dados deste aparelho?" testID="privacidade-wipe-confirm">
        <View style={styles.group}>
          <Text variant="body">
            Apaga salvos, eventos acompanhados, avaliações, mensagens, buscas e preferências guardados aqui. Não dá para desfazer.
          </Text>
          <Text variant="bodySm" tone="textMuted">
            Você volta para a verificação de idade como um visitante novo.
          </Text>
          <Button
            label="Apagar tudo"
            onPress={() => {
              setWipeOpen(false);
              client.clear();
              wipeLocalData();
              router.replace('/onboarding/idade');
            }}
            testID="privacidade-wipe-yes"
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setWipeOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', gap: space.xs, paddingBottom: space.xxxl },
  section: { marginTop: space.xl, marginBottom: space.xs },
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.md, borderWidth: 1, marginTop: space.sm },
  bold: { fontWeight: '600' },
  group: { gap: space.md },
});
