import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useEvent, useVenue } from '@/data/queries';
import { EMERGENCY_LINES, SAFETY_INCIDENT_KINDS, SAFETY_REPORT_PRIVACY, telUrl, type SafetyIncidentKind } from '@/domain/safetyReport';
import { DESCRIPTION_MAX, validateDescription } from '@/features/ajuda/tickets';
import { NARROW_MAX_WIDTH } from '@/features/layout';
import { useSupport } from '@/state/support';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Chip, ErrorState, Screen, ScreenHeader, Skeleton, Text, TextField } from '@/ui';

/** Call buttons for 190 and 180. Shared by the report screen and the emergency block (S4). */
export function EmergencyCalls({ onError }: { onError?: (msg: string) => void }) {
  return (
    <View style={styles.calls}>
      {EMERGENCY_LINES.map((l) => (
        <Button
          key={l.number}
          label={l.label}
          variant={l.number === '190' ? 'primary' : 'secondary'}
          fullWidth
          accessibilityHint={l.detail}
          onPress={() =>
            void Linking.openURL(telUrl(l.number)).catch(() => onError?.(`Não deu para abrir o telefone. Ligue ${l.number}.`))
          }
          testID={`ligar-${l.number}`}
        />
      ))}
    </View>
  );
}

/**
 * /seguranca/relato?casa=<slug>&evento=<id>: "Aconteceu algo comigo" (S3). Emergency lines first, then a private
 * report that becomes a support conversation. Never published; the casa never learns who reported.
 */
export function RelatoScreen({ slug, eventId }: { slug?: string; eventId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const venueQ = useVenue(slug);
  const eventQ = useEvent(eventId);
  const createTicket = useSupport((s) => s.createTicket);
  const [kind, setKind] = useState<SafetyIncidentKind | undefined>();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const venue = venueQ.data?.venue;
  const event = eventQ.data?.event && eventQ.data.event.venueId === venue?.id ? eventQ.data.event : undefined;
  const check = validateDescription(text);
  const kindError = tried && !kind ? 'Escolha o que aconteceu.' : null;
  const textError = (tried || check.length > DESCRIPTION_MAX) && !check.ok ? check.error : undefined;

  const submit = () => {
    setTried(true);
    if (!kind || !check.ok || !venue) return;
    const where = event ? `${event.title}, ${venue.name}` : venue.name;
    const id = createTicket({
      topic: 'seguranca',
      eventId: event?.id,
      description: `[${where}] ${text.trim()}`,
      safety: { venueId: venue.id, kind },
    });
    router.replace(`/ajuda/suporte/${id}` as Href);
  };

  return (
    <Screen testID="relato-screen" edges={['top', 'bottom']}>
      <ScreenHeader title="Aconteceu algo comigo" onBack={back} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="summary">
            <Text variant="title" accessibilityRole="header">
              Está em perigo agora?
            </Text>
            <Text variant="bodySm" tone="textMuted">
              Ligue 190 para a polícia. O 180 é a Central de Atendimento à Mulher, gratuita e 24 horas. Procure também a
              equipe da casa ou um segurança.
            </Text>
            <EmergencyCalls onError={setCallError} />
            {callError ? (
              <Text variant="bodySm" tone="dangerText" accessibilityRole="alert">
                {callError}
              </Text>
            ) : null}
          </View>

          {venueQ.isPending && venueQ.fetchStatus !== 'idle' ? (
            <Skeleton height={160} radius={radius.md} />
          ) : !venue ? (
            <ErrorState inline message="Não encontramos a casa deste relato. Volte e abra de novo pela página da casa ou do evento." />
          ) : (
            <>
              <View style={styles.group}>
                <Text variant="title" accessibilityRole="header">
                  Conte para a gente
                </Text>
                <Text variant="bodySm" tone="textMuted" testID="relato-onde">
                  {event ? `${event.title} · ${venue.name}` : venue.name}
                </Text>
                <Text variant="bodySm" tone="textMuted">
                  {SAFETY_REPORT_PRIVACY}
                </Text>
              </View>

              <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="O que aconteceu, obrigatório">
                <Text variant="bodySm" tone="textMuted">
                  O que aconteceu? *
                </Text>
                <View style={styles.chips}>
                  {SAFETY_INCIDENT_KINDS.map((k) => (
                    <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} testID={`relato-tipo-${k.value}`} />
                  ))}
                </View>
                {kindError ? (
                  <Text variant="bodySm" tone="dangerText" accessibilityRole="alert">
                    {kindError}
                  </Text>
                ) : null}
              </View>

              <TextField
                label="Como foi? *"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={DESCRIPTION_MAX + 50}
                placeholder="O que aconteceu, quando e se alguém da equipe ajudou. Não precisa dizer seu nome."
                error={textError}
                hint={`${check.length} de ${DESCRIPTION_MAX} caracteres`}
                testID="relato-texto"
              />
              <Button label="Enviar relato" icon="send" fullWidth onPress={submit} testID="relato-enviar" />
              <Text variant="caption" tone="textMuted">
                Relatos de quem fez check-in na casa podem deixar o selo Protocolo Não é Não dela como contestado até a
                equipe apurar.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  calls: { gap: space.sm },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
