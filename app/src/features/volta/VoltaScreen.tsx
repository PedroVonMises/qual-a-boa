import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useEvent } from '@/data/queries';
import {
  ARRIVED_MESSAGE,
  DEFAULT_REMINDER,
  formatPhone,
  leavingMessage,
  REMINDER_MINUTES,
  smsTo,
  TRUSTED_CONTACTS_MAX,
  validateContact,
  whatsappTo,
  type ReminderMinutes,
  type TripPlace,
  type TrustedContact,
} from '@/domain/volta';
import { ReturnInfoSection } from '@/features/casa/ReturnInfoSection';
import { NARROW_MAX_WIDTH } from '@/features/layout';
import { cancelReminder, remindersSupported, scheduleArrivalReminder } from '@/lib/reminder';
import { useVolta } from '@/state/volta';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Chip, IconButton, Screen, ScreenHeader, Text, TextField } from '@/ui';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** WhatsApp and SMS buttons for one contact with a ready message. */
function ContactRow({ contact, message, onRemove, onError }: { contact: TrustedContact; message: string; onRemove?: () => void; onError: (m: string) => void }) {
  const { colors } = useTheme();
  const open = (url: string, app: string) =>
    void Linking.openURL(url).catch(() => onError(`Não deu para abrir o ${app}. Mande a mensagem para ${contact.name} por outro app.`));
  return (
    <View style={[styles.contact, { borderColor: colors.border }]} testID={`volta-contato-${contact.phone}`}>
      <View style={styles.contactHead}>
        <View style={styles.flex}>
          <Text variant="body" style={styles.bold}>
            {contact.name}
          </Text>
          <Text variant="caption" tone="textMuted">
            {formatPhone(contact.phone)}
          </Text>
        </View>
        {onRemove ? <IconButton icon="close" label={`Tirar ${contact.name} da lista`} onPress={onRemove} testID={`volta-remover-${contact.phone}`} /> : null}
      </View>
      <View style={styles.row}>
        <Button
          label="WhatsApp"
          variant="secondary"
          icon="message"
          accessibilityLabel={`Avisar ${contact.name} pelo WhatsApp`}
          onPress={() => open(whatsappTo(contact.phone, message), 'WhatsApp')}
          style={styles.flex}
          testID={`volta-whatsapp-${contact.phone}`}
        />
        <Button
          label="SMS"
          variant="secondary"
          icon="send"
          accessibilityLabel={`Avisar ${contact.name} por SMS`}
          onPress={() => open(smsTo(contact.phone, message, Platform.OS), 'SMS')}
          style={styles.flex}
          testID={`volta-sms-${contact.phone}`}
        />
      </View>
    </View>
  );
}

function AddContact() {
  const contacts = useVolta((s) => s.contacts);
  const add = useVolta((s) => s.addContact);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (contacts.length >= TRUSTED_CONTACTS_MAX) return null;
  const submit = () => {
    const r = validateContact(name, phone, contacts);
    if (!r.ok) return setError(r.error);
    add(r.contact);
    setName('');
    setPhone('');
    setError(null);
  };
  return (
    <View style={styles.group}>
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" testID="volta-nome" />
      <TextField
        label="Celular com DDD"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        mono
        maxLength={20}
        placeholder="27 99999-0000"
        error={error ?? undefined}
        testID="volta-telefone"
      />
      <Button label="Adicionar contato" variant="secondary" icon="plus" fullWidth onPress={submit} testID="volta-adicionar" />
    </View>
  );
}

/**
 * /volta?evento=<id>: "Cheguei em casa" (S5). Up to 3 trusted contacts kept on this device; one tap opens WhatsApp or
 * SMS with "Tô saindo...", an optional local reminder ("Já chegou?"), then "Cheguei" with the same contacts.
 */
export function VoltaScreen({ eventId }: { eventId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const eventQ = useEvent(eventId);
  const { contacts, trip, removeContact, startTrip, endTrip } = useVolta();
  const [minutes, setMinutes] = useState<ReminderMinutes | null>(remindersSupported() ? DEFAULT_REMINDER : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const data = eventQ.data;
  const place: TripPlace | null = trip?.place ?? (data ? { venueName: data.venue.name, eventTitle: data.event.title } : null);
  const leaving = leavingMessage(place);

  const start = async () => {
    setStarting(true);
    setNotice(null);
    const now = Date.now();
    const reminderId = minutes ? await scheduleArrivalReminder(minutes) : null;
    if (minutes && !reminderId && remindersSupported()) setNotice('Sem permissão de notificação, não vamos lembrar você. Dá para ativar nos ajustes do celular.');
    startTrip({
      startedAt: new Date(now).toISOString(),
      place,
      eventId: data?.event.id,
      reminderId: reminderId ?? undefined,
      remindAt: reminderId && minutes ? new Date(now + minutes * 60_000).toISOString() : undefined,
    });
    setStarting(false);
  };

  const finish = async () => {
    await cancelReminder(trip?.reminderId);
    endTrip();
    setNotice('Que bom que chegou. Até a próxima!');
  };

  return (
    <Screen testID="volta-screen" edges={['top', 'bottom']}>
      <ScreenHeader title="Cheguei em casa" onBack={back} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text variant="bodySm" tone="textMuted">
            Avise até {TRUSTED_CONTACTS_MAX} pessoas de confiança que você está voltando e, depois, que chegou. Os contatos
            ficam só neste celular, e a mensagem sai pelo seu WhatsApp ou SMS. O Qual a Boa não recebe nada.
          </Text>

          {trip ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="volta-ativa">
              <Text variant="title" accessibilityRole="header">
                Você está voltando
              </Text>
              <Text variant="bodySm" tone="textMuted" testID="volta-ativa-detalhe">
                Saiu às {clock(trip.startedAt)}
                {trip.remindAt ? `. Vamos perguntar se chegou às ${clock(trip.remindAt)}.` : '.'}
              </Text>
              <Text variant="body" style={styles.bold}>
                Chegou? Avise:
              </Text>
              {contacts.map((c) => (
                <ContactRow key={c.id} contact={c} message={ARRIVED_MESSAGE} onError={setNotice} />
              ))}
              <Button label="Cheguei em casa" icon="check" fullWidth onPress={() => void finish()} testID="volta-cheguei" />
            </View>
          ) : (
            <>
              <View style={styles.group}>
                <Text variant="title" accessibilityRole="header">
                  Contatos de confiança
                </Text>
                {contacts.map((c) => (
                  <ContactRow key={c.id} contact={c} message={leaving} onRemove={() => removeContact(c.id)} onError={setNotice} />
                ))}
                <AddContact />
              </View>

              {contacts.length > 0 ? (
                <>
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text variant="bodySm" tone="textMuted">
                      Mensagem
                    </Text>
                    <Text variant="body" testID="volta-mensagem">
                      {leaving}
                    </Text>
                  </View>
                  {remindersSupported() ? (
                    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Lembrar de avisar que chegou">
                      <Text variant="bodySm" tone="textMuted">
                        Lembrar de avisar que cheguei em
                      </Text>
                      <View style={styles.chips}>
                        {REMINDER_MINUTES.map((m) => (
                          <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} testID={`volta-lembrete-${m}`} />
                        ))}
                        <Chip label="Não lembrar" selected={minutes === null} onPress={() => setMinutes(null)} testID="volta-lembrete-nao" />
                      </View>
                    </View>
                  ) : null}
                  <Button label="Tô saindo" icon="send" fullWidth loading={starting} onPress={() => void start()} testID="volta-saindo" />
                  <Text variant="caption" tone="textMuted">
                    Mande a mensagem para cada pessoa nos botões acima antes ou depois de tocar em Tô saindo.
                  </Text>
                </>
              ) : null}
            </>
          )}

          <ReturnInfoSection info={data?.venue.returnInfo} title={data ? `Na volta: ${data.venue.name}` : "Na volta"} testID="volta-info" />

          {notice ? (
            <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite" testID="volta-aviso">
              {notice}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  column: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  contact: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  contactHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});
