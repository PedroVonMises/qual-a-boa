import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { RADIUS_OPTIONS } from '@/domain/filters';
import { clearDemoData, loadDemoData, resetApp, useDemoLoaded } from '@/state/demo';
import { OUTSIDE_PILOT_MESSAGE, openSettings, refreshDeviceLocation } from '@/lib/location';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, IconButton, ListRow, Screen, Switch, Text } from '@/ui';
import { NARROW_MAX_WIDTH } from '../layout';
import { AreaSheet } from '../explorar/AreaSheet';
import { GenresSheet } from './GenresSheet';
import { LegalSheet } from './LegalSheet';
import { PRIVACY, TERMS, type LegalDoc } from './legalText';

/** Perfil tab: visitor header, preferences, about. */
export function PerfilView() {
  const router = useRouter();
  const { colors } = useTheme();
  const genreCount = useFilters((s) => s.filters.genreSlugs.length);
  const radiusKm = useFilters((s) => s.filters.radiusKm);
  const setFilters = useFilters((s) => s.set);
  const resetSession = useSession((s) => s.reset);
  const demoLoaded = useDemoLoaded((s) => s.loaded);
  const [alerts, setAlerts] = useState(true);
  const [genresOpen, setGenresOpen] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);

  const loc = useLocation();
  const permission = loc.permission;
  const [areaOpen, setAreaOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const locationStatus =
    permission === 'blocked'
      ? 'Bloqueada nas configurações. Usando o bairro escolhido ou o ponto padrão'
      : loc.outsidePilot
        ? OUTSIDE_PILOT_MESSAGE
        : loc.source === 'device'
          ? `Usando sua localização: ${loc.location.label}${loc.accuracyM > 1000 ? ' (aproximada)' : ''}`
          : loc.source === 'area'
            ? `Bairro escolhido: ${loc.location.label}`
            : permission === 'denied'
              ? 'Permissão negada. Usando o ponto padrão'
              : `Ponto padrão: ${loc.location.label}`;

  const idx = RADIUS_OPTIONS.indexOf(radiusKm);
  const step = (d: number) => setFilters({ radiusKm: RADIUS_OPTIONS[Math.min(RADIUS_OPTIONS.length - 1, Math.max(0, idx + d))] });
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
            <Text variant="title">Visitante</Text>
            <Text variant="bodySm" tone="textMuted">
              Login chega em breve
            </Text>
          </View>
        </View>
        <Button label="Entrar para sincronizar" variant="secondary" fullWidth disabled />

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
          <Text variant="body" style={styles.flex}>
            Raio padrão
          </Text>
          <IconButton icon="chevronLeft" label="Diminuir raio" variant="filled" disabled={idx <= 0} onPress={() => step(-1)} />
          <Text variant="mono" accessibilityLabel={`Raio ${radiusKm} quilômetros`} testID="radius-value" style={styles.radius}>
            {radiusKm} km
          </Text>
          <IconButton icon="chevronRight" label="Aumentar raio" variant="filled" disabled={idx >= RADIUS_OPTIONS.length - 1} onPress={() => step(1)} />
        </View>
        <Switch label="Avisos de eventos salvos" value={alerts} onValueChange={setAlerts} style={styles.switchRow} />

        <Text variant="caption" tone="textMuted" style={styles.section}>
          LOCALIZAÇÃO
        </Text>
        <ListRow title="Localização" subtitle={locationStatus} icon="pin" divider testID="location-status" />
        <ListRow title="Alterar bairro" chevron divider onPress={() => setAreaOpen(true)} />
        <ListRow
          title="Atualizar localização"
          subtitle={refreshing ? 'Buscando...' : undefined}
          divider
          disabled={refreshing}
          onPress={async () => {
            setRefreshing(true);
            try {
              await refreshDeviceLocation(true);
            } finally {
              setRefreshing(false);
            }
          }}
        />
        {permission === 'blocked' ? (
          <ListRow title="Abrir configurações" subtitle="Libere a localização para o app" divider onPress={() => openSettings()} />
        ) : null}
        <Text variant="bodySm" tone="textMuted">
          Sua localização fica neste aparelho e nunca é enviada a um servidor.
        </Text>

        <Text variant="caption" tone="textMuted" style={styles.section}>
          DADOS DE DEMONSTRAÇÃO
        </Text>
        <Text variant="bodySm" tone="textMuted" testID="demo-explainer">
          Preenche este aparelho com dados de exemplo (salvos, acompanhando, check-in, avaliações e mensagens) para você
          testar o app. Nada é enviado para a internet.{demoLoaded ? ' Dados de exemplo carregados.' : ''}
        </Text>
        <Button label="Carregar dados de exemplo" variant="secondary" fullWidth onPress={() => loadDemoData()} />
        <Button label="Limpar dados de exemplo" variant="secondary" fullWidth onPress={() => clearDemoData()} />
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
          SOBRE
        </Text>
        <ListRow title="Privacidade e dados (LGPD)" chevron divider onPress={() => setLegal(PRIVACY)} />
        <ListRow title="Termos de uso" chevron divider onPress={() => setLegal(TERMS)} />
        <ListRow title="Ajuda e suporte" chevron divider onPress={() => router.push('/ajuda')} />
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
  stepper: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: 1 },
  radius: { minWidth: 56, textAlign: 'center' },
  switchRow: { minHeight: 56 },
});