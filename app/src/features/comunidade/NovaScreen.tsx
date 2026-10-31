import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import { KIND_LABEL, THREAD_BODY_MAX, THREAD_KINDS, TITLE_MAX, type ThreadKind } from '@/domain/community';
import { formatEventDate } from '@/domain/format';
import { useCommunity } from '@/state/community';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Chip, Screen, ScreenHeader, Switch, Text } from '@/ui';
import { HandleField } from './HandleField';

/** Nova conversa: event, kind, title, optional details, anonymous toggle. */
export function NovaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string; kind?: string }>();
  const { location } = useLocation();
  const handle = useCommunity((s) => s.handle);
  const createThread = useCommunity((s) => s.createThread);
  const q = useSearchEvents({ lat: location.lat, lng: location.lng, radiusKm: 30, sort: 'date' });
  const items = (q.data?.pages[0]?.items ?? []).slice(0, 8);

  const [eventId, setEventId] = useState<string | undefined>(params.eventId || undefined);
  const [kind, setKind] = useState<ThreadKind>(THREAD_KINDS.find((k) => k === params.kind) ?? 'vale_a_pena');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const picked = items.find((i) => i.event.id === eventId);

  const submit = () => {
    if (!eventId) return setError('Escolha o evento da conversa.');
    const r = createThread({
      eventId,
      eventName: picked?.event.title ?? 'Evento',
      venueSlug: picked?.venue.slug,
      kind,
      title,
      body: details,
      anonymous,
    });
    if (typeof r === 'string') return setError(r);
    router.replace(`/comunidade/t/${r.id}` as Href);
  };

  const fieldStyle = [styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }];

  return (
    <Screen testID="comunidade-nova">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Nova conversa" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Evento, obrigatório">
            <Text variant="title">Evento *</Text>
            <View style={styles.chips}>
              {items.map(({ event }) => (
                <Chip
                  key={event.id}
                  label={`${event.title} · ${formatEventDate(event.startsAt)}`}
                  selected={eventId === event.id}
                  onPress={() => setEventId(event.id)}
                />
              ))}
              {eventId && !picked ? <Chip label="Evento selecionado" selected onPress={() => undefined} /> : null}
            </View>
            {q.isPending ? (
              <Text variant="bodySm" tone="textMuted">
                Carregando eventos...
              </Text>
            ) : null}
          </View>

          <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Sobre o quê">
            <Text variant="title">Sobre o quê?</Text>
            <View style={styles.chips}>
              {THREAD_KINDS.map((k) => (
                <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text variant="title">Título *</Text>
            <TextInput
              testID="comunidade-titulo"
              value={title}
              onChangeText={(t) => {
                setTitle(t.slice(0, TITLE_MAX));
                if (error) setError(undefined);
              }}
              maxLength={TITLE_MAX}
              accessibilityLabel="Título"
              placeholder="Ex.: a fila anda rápido?"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>

          <View style={styles.group}>
            <Text variant="title">Detalhes</Text>
            <TextInput
              testID="comunidade-detalhes"
              multiline
              value={details}
              onChangeText={(t) => setDetails(t.slice(0, THREAD_BODY_MAX))}
              maxLength={THREAD_BODY_MAX}
              accessibilityLabel="Detalhes, opcional"
              placeholder="Conte o que você quer saber"
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
              style={[fieldStyle, styles.multiline]}
            />
          </View>

          {!handle && !anonymous ? <HandleField /> : null}
          <Switch label="Postar como anônimo" value={anonymous} onValueChange={setAnonymous} />
          {handle && !anonymous ? (
            <Text variant="bodySm" tone="textMuted">
              Você aparece como @{handle}.
            </Text>
          ) : null}

          {error ? (
            <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite" testID="comunidade-erro">
              {error}
            </Text>
          ) : null}
          <Button label="Publicar" fullWidth onPress={submit} testID="comunidade-publicar" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { gap: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    minHeight: hit.button,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
  multiline: { minHeight: 112, paddingTop: space.md },
});
