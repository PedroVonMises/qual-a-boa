import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useGenres } from '@/data/queries';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useSession } from '@/state/session';
import { space } from '@/theme/tokens';
import { Button, Chip, IconButton, Screen, Text } from '@/ui';
import { NARROW_MAX_WIDTH } from '../layout';
import { AreaSheet } from './AreaSheet';
import { areaToLocation } from './areas';
import { LOCATION_MESSAGES, requestDeviceLocation } from './deviceLocation';
import { RadiusArt } from './RadiusArt';

/** Location + styles onboarding step (canvas Local). */
export function LocalView() {
  const router = useRouter();
  const finishOnboarding = useSession((s) => s.finishOnboarding);
  const setLocation = useLocation((s) => s.setLocation);
  const picked = useFilters((s) => s.filters.genreSlugs);
  const toggleGenre = useFilters((s) => s.toggleGenre);
  const genres = useGenres();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const done = () => {
    finishOnboarding();
    router.replace('/');
  };

  const useDevice = async () => {
    setBusy(true);
    setMessage(null);
    const result = await requestDeviceLocation();
    setBusy(false);
    if (result === 'granted') done();
    else setMessage(LOCATION_MESSAGES[result]);
  };

  const chooseArea = (area: string) => {
    setLocation(areaToLocation(area));
    setPickerOpen(false);
    done();
  };

  return (
    <Screen edges={['top', 'bottom']} testID="local-screen">
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={() => router.replace('/onboarding/idade')} />
          <Text variant="mono" tone="textMuted">
            2 de 2
          </Text>
        </View>
        <View style={styles.art}>
          <RadiusArt />
        </View>
        <Text variant="display" accessibilityRole="header">
          O que rola <Text variant="display" tone="accent">perto de você</Text>
        </Text>
        <Text variant="body" tone="textMuted">
          Usamos sua localização só para ordenar as casas por distância. Você pode mudar isso depois.
        </Text>
        <Text variant="bodySm" tone="textMuted">
          Seus estilos (opcional)
        </Text>
        <View style={styles.chips}>
          {(genres.data ?? []).map((g) => (
            <Chip key={g.slug} label={g.label} selected={picked.includes(g.slug)} onPress={() => toggleGenre(g.slug)} />
          ))}
        </View>
        {message ? (
          <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" testID="location-message">
            {message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label="Usar minha localização" icon="pin" fullWidth loading={busy} onPress={useDevice} />
          <Button label="Escolher o bairro" variant="secondary" fullWidth onPress={() => setPickerOpen(true)} />
        </View>
      </ScrollView>
      <AreaSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={chooseArea} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', gap: space.lg, paddingVertical: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  art: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { gap: space.md, marginTop: space.md },
});