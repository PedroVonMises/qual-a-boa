import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { CrowdLevel, MusicLevel, QueueLevel } from '@/domain/engage';
import { hasSignal, MAX_DOOR_PRICE, type ReportInput } from '@/state/live';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Chip, Sheet, Text } from '@/ui';
import { CROWD_LABEL, MUSIC_LABEL, QUEUE_LABEL } from './logic';

type Draft = Omit<ReportInput, 'eventId'>;

function Group<T extends string>({ title, labels, value, onChange }: { title: string; labels: Record<T, string>; value?: T; onChange: (v: T | undefined) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.group}>
      <Text variant="bodySm" tone="textMuted">
        {title}
      </Text>
      <View style={styles.chips}>
        {(Object.keys(labels) as T[]).map((k) => (
          <Chip key={k} label={labels[k]} selected={value === k} onPress={() => onChange(value === k ? undefined : k)} />
        ))}
      </View>
    </View>
  );
}

/** Quick report: tap what you see (all optional), add the door price if you know it. */
export function ReportSheet({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (input: Draft) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Draft>({});
  const [priceText, setPriceText] = useState('');

  const parsed = priceText.trim() === '' ? undefined : /^\d{1,4}([.,]\d{1,2})?$/.test(priceText.trim()) ? Number(priceText.trim().replace(',', '.')) : NaN;
  const priceBad = parsed !== undefined && !(Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_DOOR_PRICE);
  const input: Draft = { ...draft, priceAtDoor: priceBad ? undefined : parsed };
  const canSend = hasSignal(input) && !priceBad;

  const reset = () => {
    setDraft({});
    setPriceText('');
  };
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Relatar agora"
      footer={
        <Button
          label="Enviar relato"
          disabled={!canSend}
          fullWidth
          onPress={() => {
            onSubmit(input);
            reset();
          }}
        />
      }>
      <View style={styles.body}>
        <Text variant="bodySm" tone="textMuted">
          Conte só o que você viu agora. Pode escolher só uma opção.
        </Text>
        <Group<QueueLevel> title="Fila" labels={QUEUE_LABEL} value={draft.queue} onChange={(queue) => setDraft((d) => ({ ...d, queue }))} />
        <Group<CrowdLevel> title="Lotação" labels={CROWD_LABEL} value={draft.crowd} onChange={(crowd) => setDraft((d) => ({ ...d, crowd }))} />
        <Group<MusicLevel> title="Música" labels={MUSIC_LABEL} value={draft.music} onChange={(music) => setDraft((d) => ({ ...d, music }))} />
        <View style={styles.group}>
          <Text variant="bodySm" tone="textMuted">
            Preço na porta (R$), se souber
          </Text>
          <TextInput
            accessibilityLabel="Preço na porta em reais"
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            placeholder="Ex.: 30"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: priceBad ? colors.danger : 'transparent' }]}
          />
          {priceBad ? (
            <Text accessibilityLiveRegion="polite" variant="caption" tone="dangerText">
              Informe um valor entre 0 e {MAX_DOOR_PRICE}.
            </Text>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingBottom: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    minHeight: hit.button,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
});
