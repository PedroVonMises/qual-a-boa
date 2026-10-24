import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import type { TicketTopic } from '@/domain/engage';
import { formatEventDate } from '@/domain/format';
import { useLocation } from '@/state/location';
import { useSupport } from '@/state/support';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Icon, PressableScale, Screen, ScreenHeader, Text } from '@/ui';
import { AttachSoon, ResponseTime } from './parts';
import { DESCRIPTION_MAX, TOPIC_OPTIONS, validateDescription } from './tickets';

function Radio({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      scaleTo={0.99}
      style={[
        styles.radio,
        { backgroundColor: colors.surface, borderColor: checked ? colors.accent : colors.border },
      ]}>
      <View style={[styles.dot, { borderColor: checked ? colors.accent : colors.textMuted }]}>
        {checked ? <View style={[styles.dotFill, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <Text variant="body" style={styles.flex}>
        {label}
      </Text>
      {checked ? <Icon name="check" size={18} color="accent" /> : null}
    </PressableScale>
  );
}

function EventPicker({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const { colors } = useTheme();
  const { location } = useLocation();
  const [open, setOpen] = useState(false);
  const q = useSearchEvents({ lat: location.lat, lng: location.lng, radiusKm: 30, sort: 'date' });
  const items = (q.data?.pages[0]?.items ?? []).slice(0, 8);
  const selected = items.find((i) => i.event.id === value);
  const summary = value ? (selected ? selected.event.title : 'Evento selecionado') : 'Nenhum';

  return (
    <View style={styles.group}>
      <Text variant="bodySm" tone="textMuted">
        Evento relacionado (opcional)
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Evento relacionado, ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        scaleTo={0.99}
        style={[styles.field, styles.pickerHead, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="body" style={styles.flex} numberOfLines={1}>
          {summary}
        </Text>
        <Icon name="chevronDown" size={20} color="textMuted" />
      </PressableScale>
      {open ? (
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Escolher evento">
          <Radio label="Nenhum evento" checked={!value} onPress={() => { onChange(undefined); setOpen(false); }} />
          {items.map(({ event }) => (
            <Radio
              key={event.id}
              label={`${event.title} · ${formatEventDate(event.startsAt)}`}
              checked={value === event.id}
              onPress={() => { onChange(event.id); setOpen(false); }}
            />
          ))}
          {q.isPending ? <Text variant="bodySm" tone="textMuted">Carregando eventos...</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Novo chamado: topic, optional event, validated description. */
export function NovoChamadoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ eventId?: string; topic?: string }>();
  const createTicket = useSupport((s) => s.createTicket);
  const initialTopic = TOPIC_OPTIONS.find((o) => o.value === params.topic)?.value;
  const [topic, setTopic] = useState<TicketTopic | undefined>(initialTopic);
  const [eventId, setEventId] = useState<string | undefined>(params.eventId || undefined);
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);

  const check = validateDescription(text);
  const topicError = tried && !topic;
  const textError = (tried || check.length > DESCRIPTION_MAX) && !check.ok ? check.error : undefined;

  const submit = () => {
    setTried(true);
    if (!topic || !check.ok) return;
    const id = createTicket({ topic, eventId, description: text });
    router.replace(`/ajuda/suporte/${id}`);
  };

  return (
    <Screen testID="novo-chamado-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Novo chamado" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text variant="bodySm" tone="textMuted">
            Campos com * são obrigatórios.
          </Text>

          <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Assunto, obrigatório">
            <Text variant="title" accessibilityRole="header">
              Assunto *
            </Text>
            {TOPIC_OPTIONS.map((o) => (
              <Radio key={o.value} label={o.label} checked={topic === o.value} onPress={() => setTopic(o.value)} />
            ))}
            {topicError ? (
              <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite">
                Escolha um assunto.
              </Text>
            ) : null}
          </View>

          <EventPicker value={eventId} onChange={setEventId} />

          <View style={styles.group}>
            <Text variant="title">
              O que aconteceu? *
            </Text>
            <TextInput
              testID="novo-desc"
              accessibilityLabel="O que aconteceu? Obrigatório"
              accessibilityHint={`Escreva de 10 a ${DESCRIPTION_MAX} caracteres`}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
              placeholder="Conte o que aconteceu, com o nome do evento ou da casa."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: textError ? colors.danger : 'transparent' },
              ]}
            />
            <View style={styles.counterRow}>
              <Text
                variant="bodySm"
                tone={textError ? 'dangerText' : 'textMuted'}
                accessibilityLiveRegion="polite"
                style={styles.flex}>
                {textError ?? 'Use de 10 a 1000 caracteres.'}
              </Text>
              <Text variant="caption" tone="textMuted">
                {check.length}/{DESCRIPTION_MAX}
              </Text>
            </View>
          </View>

          <AttachSoon label="Anexar print (opcional)" />

          <Button label="Enviar chamado" fullWidth onPress={submit} testID="novo-enviar" />
          <ResponseTime />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { gap: space.xl, paddingBottom: space.xxxl },
  group: { gap: space.sm },
  radio: {
    minHeight: hit.min + 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5 },
  field: { minHeight: hit.min + 4, paddingHorizontal: space.lg, borderRadius: radius.md },
  pickerHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1 },
  input: {
    minHeight: 140,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
  counterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
