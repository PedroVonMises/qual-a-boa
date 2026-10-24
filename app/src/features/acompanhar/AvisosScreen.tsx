import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import type { AlertChannel } from '@/domain/engage';
import { ALERT_KINDS, useFollows } from '@/state/follows';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, EmptyState, Screen, ScreenHeader, Switch, Text } from '@/ui';
import { ALERT_COPY, DEMO_LABEL, isDemoVenue } from './logic';

const CHANNELS: { key: AlertChannel; label: string }[] = [
  { key: 'push', label: 'Notificação no app' },
  { key: 'email', label: 'E-mail' },
];

/** Avisos: per-event alert toggles and delivery channels. Changes save as soon as they are made. */
export function AvisosScreen({ eventId }: { eventId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const follows = useFollows((s) => s.follows);
  const setAlert = useFollows((s) => s.setAlert);
  const setChannel = useFollows((s) => s.setChannel);
  const unfollow = useFollows((s) => s.unfollow);

  const id = eventId && follows[eventId] ? eventId : eventId ? undefined : Object.keys(follows)[0];
  const follow = id ? follows[id] : undefined;
  const q = useEvent(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acompanhar' as Href));

  if (!follow || !id) {
    return (
      <Screen>
        <ScreenHeader title="Avisos" onBack={back} />
        <EmptyState
          title="Nenhum evento para configurar"
          message="Acompanhe um evento para escolher quando e como receber avisos."
          actionLabel="Ir para Acompanhar"
          onAction={() => router.replace('/acompanhar' as Href)}
        />
      </Screen>
    );
  }

  const subtitle = q.data ? `${q.data.event.title} · ${q.data.venue.name}${isDemoVenue(q.data.venue.slug) ? ` · ${DEMO_LABEL}` : ''}` : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Avisos" onBack={back} />
        {subtitle ? (
          <Text variant="bodySm" tone="textMuted" style={styles.sub}>
            {subtitle}
          </Text>
        ) : null}

        <Text variant="bodySm" tone="textMuted" style={styles.sub}>
          Em breve: por enquanto suas escolhas ficam salvas neste aparelho e ainda não geram envio de notificação ou e-mail.
        </Text>

        <Text variant="title" accessibilityRole="header" style={styles.h}>
          Me avise quando
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ALERT_KINDS.map((k) => (
            <View key={k} style={styles.item}>
              <Switch label={ALERT_COPY[k].title} value={follow.alerts[k]} onValueChange={(v) => setAlert(id, k, v)} />
              <Text variant="bodySm" tone="textMuted">
                {ALERT_COPY[k].subtitle}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="title" accessibilityRole="header" style={styles.h}>
          Como receber
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {CHANNELS.map((c) => (
            <Switch key={c.key} label={c.label} value={follow.channels[c.key]} onValueChange={(v) => setChannel(id, c.key, v)} />
          ))}
        </View>

        <Text accessibilityLiveRegion="polite" variant="bodySm" tone="textMuted" style={styles.note}>
          As mudanças salvam sozinhas. Por enquanto as preferências ficam só neste aparelho e os avisos aparecem em Acompanhar.
        </Text>

        <Button
          label="Parar de acompanhar este evento"
          variant="secondary"
          onPress={() => {
            unfollow(id);
            back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: space.md, paddingBottom: space.xxxl },
  sub: { marginTop: -space.xs },
  h: { marginTop: space.md },
  group: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.xs },
  item: { paddingBottom: space.xs },
  note: { marginVertical: space.sm },
});
