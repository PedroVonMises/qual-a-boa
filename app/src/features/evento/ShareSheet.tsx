import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';

import { formatEventDate, formatPriceLabel } from '@/domain/format';
import type { EventItem, Venue } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space, type } from '@/theme/tokens';
import { Cover, Icon, PressableScale, Sheet, Text, type IconName } from '@/ui';
import { deepLink, whatsappUrl } from './linking';

/** Default invite text. Kept short so it reads well as a WhatsApp preview. */
export function inviteMessage(event: Pick<EventItem, 'title' | 'startsAt' | 'priceMin' | 'priceMax' | 'isFree'>, venue: Pick<Venue, 'name'>, now: number = Date.now()): string {
  const when = formatEventDate(event.startsAt, now).replace(' · ', ', ');
  const price = formatPriceLabel(event.priceMin, event.priceMax, event.isFree);
  return `Bora no ${event.title}? ${when} no ${venue.name}. ${price}. Quem topa?`;
}

const withLink = (msg: string, url: string) => `${msg.trim()}\n${url}`;

async function copyText(text: string): Promise<boolean> {
  const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
  if (!nav?.clipboard?.writeText) return false;
  try {
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Channel({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.channel, { backgroundColor: colors.surfaceAlt }]} testID={testID}>
      <Icon name={icon} size={24} />
      <Text variant="caption" style={styles.center}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  event: EventItem;
  venue: Venue;
}

/** "Chamar a galera": an editable invite sent through WhatsApp, the clipboard (web) or the system share sheet. */
export function ShareSheet({ visible, onClose, event, venue }: ShareSheetProps) {
  if (!visible) return null;
  return <ShareBody onClose={onClose} event={event} venue={venue} />;
}

function ShareBody({ onClose, event, venue }: Omit<ShareSheetProps, 'visible'>) {
  const { colors } = useTheme();
  const url = deepLink(`/evento/${event.id}`);
  const [message, setMessage] = useState(() => inviteMessage(event, venue));
  const [status, setStatus] = useState<string | null>(null);
  const canCopy = Platform.OS === 'web';

  const whatsapp = () => {
    Linking.openURL(whatsappUrl(withLink(message, url))).catch(() => setStatus('Não deu para abrir o WhatsApp. Tente "Mais opções".'));
  };
  const copy = async () => setStatus((await copyText(withLink(message, url))) ? 'Convite copiado. É só colar na conversa.' : 'Não deu para copiar. Tente "Mais opções".');
  const more = () => {
    Share.share({ title: event.title, message: withLink(message, url), url })
      .then(() => onClose())
      .catch(() => setStatus('Este aparelho não abriu o compartilhamento.'));
  };

  return (
    <Sheet visible onClose={onClose} title="Chamar a galera" testID="share-sheet">
      <View style={styles.wrap}>
        <View style={[styles.preview, { backgroundColor: colors.background }]}>
          <Cover coverKey={event.coverKey} imageUrl={event.imageUrl} style={styles.cover} />
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={1}>
              {event.title}
            </Text>
            <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
              {venue.name} · {venue.area}
            </Text>
            <Text variant="mono">{formatEventDate(event.startsAt)}</Text>
          </View>
        </View>
        <View style={styles.group}>
          <Text variant="bodySm" tone="textMuted">
            Mensagem
          </Text>
          <TextInput
            accessibilityLabel="Mensagem do convite"
            multiline
            value={message}
            onChangeText={(t) => {
              setMessage(t);
              setStatus(null);
            }}
            maxLength={280}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            testID="share-message"
          />
          <Text variant="caption" tone="textMuted">
            O link do evento vai junto. Quem não tem o app abre no navegador.
          </Text>
        </View>
        <View style={styles.channels}>
          <Channel icon="send" label="WhatsApp" onPress={whatsapp} testID="share-whatsapp" />
          {canCopy ? <Channel icon="paperclip" label="Copiar convite" onPress={() => void copy()} testID="share-copy" /> : null}
          <Channel icon="share" label="Mais opções" onPress={more} testID="share-more" />
        </View>
        {status ? (
          <Text variant="bodySm" accessibilityLiveRegion="polite" testID="share-status">
            {status}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  cover: { width: 64, height: 64, borderRadius: 14 },
  group: { gap: space.sm },
  input: {
    minHeight: 96,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    textAlignVertical: 'top',
  },
  channels: { flexDirection: 'row', gap: space.sm },
  channel: { flex: 1, minHeight: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.sm },
});
