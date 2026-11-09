import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { DISPLAY_NAME_MAX, displayNameKey, saveDisplayName, useDisplayName, validateDisplayName } from '@/data/account';
import { useAddress, useSaveAddress } from '@/data/address';
import { useAccountEmail } from '@/data/auth';
import { VenueMapSchematic } from '@/features/mapa/VenueMapSchematic';
import { NARROW_MAX_WIDTH } from '@/features/layout';
import { geocodeAddress } from '@/lib/location';
import { addressLabel, useProfile } from '@/state/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Screen, ScreenHeader, Text, TextField } from '@/ui';
import { AddressForm } from './AddressForm';
import { deleteAddress } from './deleteAddress';
import {
  addressFieldErrors,
  draftFromAddress,
  draftToAddress,
  formatPhone,
  geocodeQuery,
  isDraftEmpty,
  isValidPhone,
  normalizePhone,
  type AddressDraft,
  type AddressErrors,
} from './format';

type Note = { text: string; tone: 'ok' | 'warn' | 'error' };

function Caption({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="textMuted" accessibilityRole="header" style={styles.section}>
      {children}
    </Text>
  );
}

/** Dados cadastrais: name / e-mail / phone, and the registered address used for "Perto de casa". */
export function DadosCadastraisScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const { colors } = useTheme();
  const email = useAccountEmail();
  const savedName = useDisplayName();
  const storedPhone = useProfile((s) => s.phone);
  const setPhone = useProfile((s) => s.setPhone);
  const { address } = useAddress();
  const saveAddress = useSaveAddress();

  // null = untouched, so the fields follow the stored values as they load.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [addrDraft, setAddrDraft] = useState<AddressDraft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; address: AddressErrors }>({ address: {} });
  const [note, setNote] = useState<Note | undefined>();
  const [precise, setPrecise] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const name = nameDraft ?? savedName.data ?? '';
  const phone = phoneDraft ?? formatPhone(storedPhone ?? '');
  const addr = addrDraft ?? draftFromAddress(address);

  const onSave = async () => {
    setNote(undefined);
    const next: typeof errors = { address: {} };
    const nameCheck = email && nameDraft !== null ? validateDisplayName(nameDraft) : null;
    if (nameCheck && !nameCheck.ok) next.name = nameCheck.error;
    if (!isValidPhone(phone)) next.phone = 'Digite o DDD e o número, como (27) 99999-0000.';
    const saveAddr = addrDraft !== null && !isDraftEmpty(addrDraft);
    if (saveAddr) next.address = addressFieldErrors(addrDraft);
    setErrors(next);
    if (next.name || next.phone || Object.keys(next.address).length) {
      setNote({ text: 'Confira os campos marcados.', tone: 'error' });
      return;
    }

    setSaving(true);
    const warnings: string[] = [];
    try {
      setPhone(normalizePhone(phone) || undefined);
      if (nameCheck?.ok && nameCheck.name !== (savedName.data ?? '')) {
        const res = await saveDisplayName(nameCheck.name);
        if (res.ok) await client.invalidateQueries({ queryKey: displayNameKey });
        else warnings.push(res.error);
      }
      if (saveAddr) {
        const geo = await geocodeAddress(geocodeQuery(addrDraft), {
          district: addrDraft.district,
          label: addressLabel(addrDraft),
        });
        const res = await saveAddress(draftToAddress(addrDraft, geo.point));
        if (!res.ok) {
          setNote({ text: res.error, tone: 'error' });
          return;
        }
        setPrecise(geo.precise);
        setAddrDraft(null);
        if (res.warning) warnings.push(res.warning);
      }
      setNameDraft(null);
      setPhoneDraft(null);
      setNote(warnings.length ? { text: warnings.join(' '), tone: 'warn' } : { text: 'Dados salvos.', tone: 'ok' });
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAddress = async () => {
    setNote(undefined);
    setErrors((e) => ({ ...e, address: {} }));
    const res = await deleteAddress(client);
    setAddrDraft(null);
    setPrecise(null);
    setNote(res.warning ? { text: res.warning, tone: 'warn' } : { text: 'Endereço apagado.', tone: 'ok' });
  };

  return (
    <Screen testID="dados-cadastrais-screen" edges={['top', 'bottom']}>
      <ScreenHeader title="Dados cadastrais" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Caption>VOCÊ</Caption>
          {email ? (
            <>
              <TextField
                label="Nome"
                value={name}
                onChangeText={setNameDraft}
                maxLength={DISPLAY_NAME_MAX}
                placeholder="Como quer ser chamado"
                autoComplete="name"
                error={errors.name}
                testID="dados-nome"
              />
              <TextField label="E-mail" value={email} editable={false} hint="Para trocar, entre com outro e-mail." testID="dados-email" />
            </>
          ) : null}
          <TextField
            label="Celular"
            hint="Opcional"
            mono
            value={phone}
            onChangeText={(t) => setPhoneDraft(formatPhone(t))}
            keyboardType="phone-pad"
            maxLength={15}
            placeholder="(27) 99999-0000"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phone}
            testID="dados-celular"
          />

          <Caption>ENDEREÇO</Caption>
          <AddressForm value={addr} onChange={setAddrDraft} errors={errors.address} />

          {address && addrDraft === null ? (
            <View style={styles.preview} testID="dados-preview">
              <View style={[styles.map, { borderColor: colors.border }]}>
                <VenueMapSchematic
                  pins={[]}
                  selectedId={null}
                  onSelect={() => undefined}
                  center={{ lat: address.lat, lng: address.lng, label: addressLabel(address) }}
                  userLocation={{ lat: address.lat, lng: address.lng, label: addressLabel(address) }}
                />
              </View>
              <Text variant="bodySm" tone="textMuted">
                {precise === false ? `Vamos usar o centro do bairro ${address.district}.` : `Ponto de “Perto de casa”: ${addressLabel(address)}.`}
              </Text>
            </View>
          ) : null}

          <Text variant="bodySm" tone="textMuted">
            Esse endereço fica salvo na sua conta e serve de ponto para “Perto de casa”. Você pode apagar quando quiser.
          </Text>
          {address ? <Button label="Apagar endereço" variant="ghost" onPress={onDeleteAddress} testID="dados-apagar-endereco" /> : null}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {note ? (
            <Text
              variant="bodySm"
              tone={note.tone === 'error' ? 'dangerText' : note.tone === 'warn' ? 'text' : 'textMuted'}
              accessibilityLiveRegion="polite"
              testID="dados-note">
              {note.text}
            </Text>
          ) : null}
          <Button label="Salvar dados" fullWidth loading={saving} onPress={onSave} testID="dados-salvar" />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', gap: space.md, paddingBottom: space.xxxl },
  section: { marginTop: space.lg },
  preview: { gap: space.sm },
  map: { height: 180, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  footer: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderTopWidth: 1,
  },
});
