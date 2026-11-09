import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useDisplayName } from '@/data/account';
import { useMyVenueAccounts } from '@/data/casas';
import { authAvailable, signOut, useAccountEmail } from '@/data/auth';
import { env } from '@/lib/env';
import { clearDemoData, loadDemoData, resetApp, useDemoLoaded } from '@/state/demo';
import { OUTSIDE_PILOT_MESSAGE, openSettings, refreshDeviceLocation } from '@/lib/location';
import { relativeTimePt, useGenres } from '@/data/queries';
import { explainProfile, useResetRecommendations, useTasteProfile } from '../explorar/useTasteProfile';
import { useFilters } from '@/state/filters';
import { useLocation, type Origin } from '@/state/location';
import { addressLabel, useProfile } from '@/state/profile';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, ListRow, Screen, SegmentedControl, Switch, Text, type SegmentOption } from '@/ui';
import { RadiusSlider } from '../filtros';
import { NARROW_MAX_WIDTH } from '../layout';
import { AreaSheet } from '../explorar/AreaSheet';
import { FeedStatusRow } from './FeedStatusRow';
import { GenresSheet } from './GenresSheet';
import { LegalSheet } from './LegalSheet';
import { TERMS, type LegalDoc } from './legalText';

const ORIGIN_OPTIONS: SegmentOption<Origin>[] = [
  { value: 'live', label: 'Tempo real' },
  { value: 'registered', label: 'Endereço' },
];

export const LOCATION_PRIVACY_NOTE =
  'Sua localização em tempo real fica só neste aparelho. O endereço que você cadastra fica salvo na sua conta, e você pode apagar quando quiser.';

/** Perfil tab: visitor header, preferences, about. */
export function PerfilView() {
  const router = useRouter();
  const { colors } = useTheme();
  const genreCount = useFilters((s) => s.filters.genreSlugs.length);
  const radiusKm = useFilters((s) => s.filters.radiusKm);
  const setFilters = useFilters((s) => s.set);
  const resetSession = useSession((s) => s.reset);
  const demoLoaded = useDemoLoaded((s) => s.loaded);
  const accountEmail = useAccountEmail();
  const displayName = useDisplayName().data;
  const loginAvailable = authAvailable();
  const [alerts, setAlerts] = useState(true);
  const [genresOpen, setGenresOpen] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);

  const profile = useTasteProfile();
  const genres = useGenres();
  const resetReco = useResetRecommendations();
  const labelBySlug = Object.fromEntries((genres.data ?? []).map((g) => [g.slug, g.label]));
  const loc = useLocation();
  const setPreferred = useLocation((s) => s.setPreferred);
  const permission = loc.permission;
  const [areaOpen, setAreaOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const address = useProfile((s) => s.address);
  const liveStatus =
    permission === 'blocked'
      ? 'Bloqueada nas configurações'
      : loc.live && permission === 'granted'
        ? loc.liveOutsidePilot
          ? OUTSIDE_PILOT_MESSAGE
          : `Agora em ${loc.live.point.label} · ${relativeTimePt(loc.live.at)}${(loc.live.accuracyM ?? 0) > 1000 ? ' (aproximada)' : ''}`
        : permission === 'denied'
          ? 'Permissão negada. Toque para tentar de novo'
          : 'Permitir localização';
  const registeredStatus = address ? addressLabel(address) : loc.registered ? `Bairro: ${loc.registered.label}` : 'Cadastrar endereço';
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshDeviceLocation(true);
    } finally {
      setRefreshing(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen testID="perfil-screen">
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <Text variant="headline" accessibilityRole="header">
          Perfil
        </Text>
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="user" size={32} color="textMuted" />
          </View>
          <View style={styles.flex}>
            <Text variant="title">{accountEmail ? (displayName ?? 'Conta') : 'Visitante'}</Text>
            <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
              {accountEmail ?? (loginAvailable ? 'Entre para guardar seus dados' : 'Login chega em breve')}
            </Text>
          </View>
        </View>
        {accountEmail ? (
          <Button label="Sair" variant="secondary" fullWidth onPress={() => void signOut()} testID="perfil-sair" />
        ) : (
          <Button
            label="Entrar para sincronizar"
            variant="secondary"
            fullWidth
            disabled={!loginAvailable}
            onPress={() => router.push('/entrar')}
            testID="perfil-entrar"
          />
        )}

        {loginAvailable ? (
          <ListRow title="Minha conta" subtitle="Nome, exportar e apagar seus dados" icon="user" chevron divider onPress={() => router.push('/conta')} testID="perfil-conta" />
        ) : null}
        <ListRow
          title="Dados cadastrais"
          subtitle="Nome, contato e endereço"
          icon="user"
          chevron
          divider
          onPress={() => router.push('/dados-cadastrais')}
          testID="perfil-dados-cadastrais"
        />
        <ListRow title="Meus eventos" subtitle="Avaliações, check-ins e eventos que você acompanha" icon="bookmark" chevron divider onPress={() => router.push('/meus-eventos')} testID="perfil-meus-eventos" />

        <Text variant="caption" tone="textMuted" style={styles.section}>
          PREFERÊNCIAS
        </Text>
        <ListRow
          title="Estilos favoritos"
          value={genreCount ? String(genreCount) : 'Todos'}
          chevron
          divider
          onPress={() => setGenresOpen(true)}
        />
        <View style={[styles.stepper, { borderBottomColor: colors.border }]}>
          <Text variant="body">Raio padrão</Text>
          <RadiusSlider value={radiusKm} onChange={(r) => setFilters({ radiusKm: r })} />
        </View>
        <Switch label="Avisos de eventos salvos" value={alerts} onValueChange={setAlerts} style={styles.switchRow} />

        <Text variant="caption" tone="textMuted" style={styles.section}>
          LOCALIZAÇÃO
        </Text>
        <Text variant="bodySm" tone="textMuted">
          Calcular distância a partir de
        </Text>
        <SegmentedControl
          label="Calcular distância a partir de"
          options={ORIGIN_OPTIONS}
          value={loc.preferred}
          onChange={setPreferred}
        />
        <ListRow
          title="Tempo real"
          subtitle={refreshing ? 'Buscando...' : liveStatus}
          icon="compass"
          value={loc.activeOrigin === 'live' ? 'Em uso' : undefined}
          divider
          disabled={refreshing || permission === 'blocked'}
          onPress={loc.live && permission === 'granted' ? undefined : refresh}
          testID="origin-live"
        />
        <ListRow
          title="Endereço"
          subtitle={registeredStatus}
          icon="pin"
          value={loc.activeOrigin === 'registered' ? 'Em uso' : undefined}
          chevron
          divider
          onPress={() => router.push('/dados-cadastrais')}
          testID="origin-registered"
        />
        {loc.activeOrigin === 'default' ? (
          <Text variant="bodySm" tone="textMuted" testID="origin-default">
            {loc.outsidePilot ? `${OUTSIDE_PILOT_MESSAGE}. ` : ''}Usando o ponto padrão: {loc.location.label}
          </Text>
        ) : null}
        <ListRow title="Alterar bairro" chevron divider onPress={() => setAreaOpen(true)} />
        <ListRow
          title="Atualizar localização"
          subtitle={refreshing ? 'Buscando...' : undefined}
          divider
          disabled={refreshing}
          onPress={refresh}
        />
        {permission === 'blocked' ? (
          <ListRow title="Abrir configurações" subtitle="Libere a localização para o app" divider onPress={() => openSettings()} />
        ) : null}
        <Text variant="bodySm" tone="textMuted">
          {LOCATION_PRIVACY_NOTE}
        </Text>

        <Text variant="caption" tone="textMuted" style={styles.section}>
          RECOMENDAÇÕES
        </Text>
        <Text variant="bodySm" tone="textMuted">
          Por que estou vendo isso?
        </Text>
        {explainProfile(profile, labelBySlug).map((line) => (
          <Text key={line} variant="bodySm" testID="reco-explain-line">
            {line}
          </Text>
        ))}
        <Text variant="bodySm" tone="textMuted">
          O gosto é calculado só neste aparelho, a partir dos seus salvos, eventos acompanhados, check-ins, avaliações e
          filtros.
        </Text>
        <Button label="Zerar recomendações" variant="secondary" fullWidth onPress={() => resetReco()} />

        {env.demoTools ? (
          <>
            <Text variant="caption" tone="textMuted" style={styles.section}>
              DADOS DE DEMONSTRAÇÃO
            </Text>
            <Text variant="bodySm" tone="textMuted" testID="demo-explainer">
              Preenche este aparelho com dados de exemplo (salvos, acompanhando, check-in, avaliações e mensagens) para
              você testar o app. Nada é enviado para a internet.{demoLoaded ? ' Dados de exemplo carregados.' : ''}
            </Text>
            <Button label="Carregar dados de exemplo" variant="secondary" fullWidth onPress={() => loadDemoData()} />
            <Button label="Limpar dados de exemplo" variant="secondary" fullWidth onPress={() => clearDemoData()} />
          </>
        ) : null}
        <Button
          label="Voltar ao início (resetar app)"
          variant="ghost"
          fullWidth
          accessibilityHint="Apaga tudo neste aparelho e mostra a verificação de idade de novo"
          onPress={() => {
            resetApp();
            router.replace('/onboarding/idade');
          }}
        />

        <Text variant="caption" tone="textMuted" style={styles.section}>
          PARA CASAS NOTURNAS
        </Text>
        <CasasRow />

        <Text variant="caption" tone="textMuted" style={styles.section}>
          SOBRE
        </Text>
        <ListRow title="Privacidade e dados (LGPD)" chevron divider onPress={() => router.push('/privacidade')} testID="perfil-privacidade" />
        <ListRow title="Termos de uso" chevron divider onPress={() => setLegal(TERMS)} />
        <ListRow title="Ajuda e suporte" chevron divider onPress={() => router.push('/ajuda')} />
        <FeedStatusRow />
        <ListRow title="Versão do app" value={version} divider={__DEV__} />
        {__DEV__ ? (
          <ListRow
            title="Refazer a verificação de idade"
            subtitle="Só em desenvolvimento"
            onPress={() => {
              resetSession();
              router.replace('/onboarding/idade');
            }}
          />
        ) : null}
      </ScrollView>
      <GenresSheet visible={genresOpen} onClose={() => setGenresOpen(false)} />
      <AreaSheet visible={areaOpen} onClose={() => setAreaOpen(false)} />
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', gap: space.md, paddingVertical: space.lg },
  flex: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space.lg },
  stepper: { gap: space.sm, paddingBottom: space.md, borderBottomWidth: 1 },
  switchRow: { minHeight: 56 },
});

/** Entry point for venue owners: the plan screen, or the venue panel once the user belongs to a venue account. */
function CasasRow() {
  const router = useRouter();
  const accounts = useMyVenueAccounts();
  const member = (accounts.data?.length ?? 0) > 0;
  return member ? (
    <ListRow title="Painel da casa" subtitle="Suas festas e a assinatura" icon="spark" chevron divider onPress={() => router.push('/casas/painel')} testID="perfil-casas" />
  ) : (
    <ListRow title="Sua casa no Qual a boa?" subtitle="Divulgue 4 festas por mês" icon="spark" chevron divider onPress={() => router.push('/casas')} testID="perfil-casas" />
  );
}
