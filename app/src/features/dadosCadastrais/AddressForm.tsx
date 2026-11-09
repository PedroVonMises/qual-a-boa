import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatCep, isCepError, lookupCep, normalizeCep } from '@/lib/cep';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Icon, Text, TextField } from '@/ui';
import { confirmLine, type AddressDraft, type AddressErrors } from './format';

export interface AddressFormProps {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  /** Per-field errors from the parent (after a save attempt). */
  errors?: AddressErrors;
  /** Prefix for field testIDs (default "address"). */
  testID?: string;
  /** CEP lookup, injectable for tests (default ViaCEP). */
  lookup?: typeof lookupCep;
}

type CepState = { status: 'idle' | 'loading' | 'ok' } | { status: 'error'; message: string };

/**
 * Controlled address form: CEP (mono, 00000-000) fills street / district / city / UF when it reaches 8 digits
 * (all still editable), then number (required) and complement (optional). Reused by Dados cadastrais and Casas.
 */
export function AddressForm({ value, onChange, errors = {}, testID = 'address', lookup = lookupCep }: AddressFormProps) {
  const { colors } = useTheme();
  const [cep, setCep] = useState<CepState>({ status: 'idle' });
  const latest = useRef(value);
  const asked = useRef<string | null>(null);
  useEffect(() => {
    latest.current = value;
  });

  const set = (patch: Partial<AddressDraft>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onChange(next);
  };

  const onCep = async (raw: string) => {
    const digits = normalizeCep(raw);
    set({ cep: formatCep(digits) });
    if (digits.length < 8) {
      asked.current = null;
      setCep({ status: 'idle' });
      return;
    }
    if (asked.current === digits) return;
    asked.current = digits;
    setCep({ status: 'loading' });
    const res = await lookup(digits);
    if (asked.current !== digits) return; // the CEP changed while we waited
    if (isCepError(res)) {
      setCep({ status: 'error', message: res.message });
      return;
    }
    const cur = latest.current;
    set({ street: res.street || cur.street, district: res.district || cur.district, city: res.city, uf: res.uf });
    setCep({ status: 'ok' });
  };

  const cepDigits = normalizeCep(value.cep);
  const cepError = cep.status === 'error' ? cep.message : errors.cep;
  const confirmed =
    cep.status !== 'loading' && !cepError && cepDigits.length === 8 && !!value.city.trim() && !!value.uf.trim();

  return (
    <View style={styles.form}>
      <TextField
        label="CEP"
        mono
        value={value.cep}
        onChangeText={onCep}
        keyboardType="number-pad"
        maxLength={9}
        placeholder="00000-000"
        autoComplete="postal-code"
        textContentType="postalCode"
        error={cepError}
        testID={`${testID}-cep`}
      />
      {cep.status === 'loading' ? (
        <View style={styles.line} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text variant="bodySm" tone="textMuted">
            Buscando o CEP...
          </Text>
        </View>
      ) : confirmed ? (
        <View style={styles.line} accessibilityLiveRegion="polite" testID={`${testID}-confirm`}>
          <Icon name="check" size={18} color="success" />
          <Text variant="bodySm" style={styles.flex}>
            {confirmLine(value)}
          </Text>
        </View>
      ) : null}
      <TextField
        label="Rua"
        value={value.street}
        onChangeText={(street) => set({ street })}
        autoComplete="street-address"
        error={errors.street}
        testID={`${testID}-street`}
      />
      <View style={styles.row}>
        <TextField
          label="Número"
          mono
          value={value.number}
          onChangeText={(number) => set({ number })}
          maxLength={20}
          error={errors.number}
          style={styles.cell}
          testID={`${testID}-number`}
        />
        <TextField
          label="Complemento"
          hint="Opcional"
          value={value.complement}
          onChangeText={(complement) => set({ complement })}
          maxLength={100}
          error={errors.complement}
          style={styles.cell}
          testID={`${testID}-complement`}
        />
      </View>
      <TextField
        label="Bairro"
        value={value.district}
        onChangeText={(district) => set({ district })}
        error={errors.district}
        testID={`${testID}-district`}
      />
      <View style={styles.row}>
        <TextField
          label="Cidade"
          value={value.city}
          onChangeText={(city) => set({ city })}
          error={errors.city}
          style={styles.city}
          testID={`${testID}-city`}
        />
        <TextField
          label="UF"
          value={value.uf}
          onChangeText={(uf) => set({ uf: uf.replace(/[^A-Za-z]/g, '').toUpperCase() })}
          autoCapitalize="characters"
          maxLength={2}
          error={errors.uf}
          style={styles.uf}
          testID={`${testID}-uf`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  // Wraps to one field per line when the font scale makes the pair too wide.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { flexGrow: 1, flexBasis: 140 },
  city: { flexGrow: 3, flexBasis: 180 },
  uf: { flexGrow: 1, flexBasis: 72 },
});
