import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { EMERGENCY_LINES, locationShareMessage, telUrl, type SharePlace } from '@/domain/safetyReport';
import { getFix, getPermission, requestPermission } from '@/lib/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, Text } from '@/ui';

/** Own position for the share message, asking for permission only now (the person tapped share). Never throws. */
async function currentPoint(): Promise<{ lat: number; lng: number } | null> {
  try {
    let perm = await getPermission();
    if (perm === 'undetermined' || perm === 'denied') perm = await requestPermission();
    if (perm !== 'granted') return null;
    const r = await getFix();
    return r.ok ? { lat: r.fix.point.lat, lng: r.fix.point.lng } : null;
  } catch {
    return null;
  }
}

/**
 * Botões de emergência (S4), on Evento, Ao vivo and Casa: call 190 / 180 and share where I am through the system
 * share sheet (WhatsApp, SMS...). Nothing is sent to our server or stored.
 */
export function EmergencyActions({ place, testID = 'emergencia' }: { place: SharePlace; testID?: string }) {
  const { colors } = useTheme();
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const call = (number: string) => {
    setNotice(null);
    void Linking.openURL(telUrl(number)).catch(() => setNotice(`Não deu para abrir o telefone. Ligue ${number}.`));
  };

  const share = async () => {
    setNotice(null);
    setSharing(true);
    const me = await currentPoint();
    try {
      await Share.share({ message: locationShareMessage(place, me) });
      if (!me) setNotice('Não conseguimos sua localização exata, então enviamos o endereço da casa.');
    } catch {
      setNotice('Não deu para abrir o compartilhamento. Envie o endereço da casa para alguém de confiança.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={testID}>
      <View style={styles.head}>
        <Icon name="shield" size={20} color="textMuted" />
        <Text variant="bodySm" tone="textMuted" accessibilityRole="header">
          Emergência
        </Text>
      </View>
      <View style={styles.row}>
        {EMERGENCY_LINES.map((l) => (
          <Button
            key={l.number}
            label={l.label}
            variant={l.number === '190' ? 'primary' : 'secondary'}
            accessibilityHint={l.detail}
            onPress={() => call(l.number)}
            style={styles.flex}
            testID={`${testID}-ligar-${l.number}`}
          />
        ))}
      </View>
      <Button
        label="Compartilhar minha localização"
        variant="secondary"
        icon="pin"
        fullWidth
        loading={sharing}
        accessibilityHint="Abre o compartilhamento do celular. O app não guarda sua localização."
        onPress={() => void share()}
        testID={`${testID}-localizacao`}
      />
      {notice ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite" testID={`${testID}-aviso`}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
