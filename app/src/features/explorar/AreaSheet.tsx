import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { relativeTimePt, useAreas } from '@/data/queries';
import { OUTSIDE_PILOT_MESSAGE, openSettings, refreshDeviceLocation } from '@/lib/location';
import { useFilters } from '@/state/filters';
import { useLocation, type Origin } from '@/state/location';
import { addressLabel, useProfile } from '@/state/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import { Button, Chip, Icon, ListRow, PressableScale, Sheet, Text, type IconName } from '@/ui';
import { radioGroup } from '@/ui/radioGroup';

const FAIL_MESSAGES = {
  denied: 'Sem permissão de localização. Use seu endereço ou escolha um bairro abaixo.',
  blocked: 'A localização está bloqueada para o app. Abra as configurações ou escolha um bairro abaixo.',
  unavailable: 'Não deu para pegar sua localização agora. Escolha um bairro abaixo.',
  timeout: 'Não deu para pegar sua localização agora. Escolha um bairro abaixo.',
} as const;

interface OriginOptionProps {
  title: string;
  subtitle: string;
  icon: IconName;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
  a11y: object;
}

/** Large selectable card with a radio dot: the dot plus the "checked" state carry the selection, not color alone. */
function OriginOption({ title, subtitle, icon, checked, disabled, onPress, testID, a11y }: OriginOptionProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.98}
      testID={testID}
      style={[
        styles.option,
        { backgroundColor: colors.surfaceAlt, borderColor: checked ? colors.accent : colors.border },
        disabled && styles.disabled,
      ]}
      {...a11y}>
      <Icon name={icon} size={24} color={checked ? 'accent' : 'textMuted'} />
      <View style={styles.flex}>
        <Text variant="body" style={styles.bold}>
          {title}
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {subtitle}
        </Text>
      </View>
      <View style={[styles.radio, { borderColor: checked ? colors.accent : colors.textMuted }]}>
        {checked ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
      </View>
    </PressableScale>
  );
}

/**
 * "Onde você quer sair?": which origin counts the distance (live fix or registered address), then an optional
 * neighbourhood filter.
 */
export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: areas } = useAreas();
  const area = useFilters((s) => s.filters.area);
  const set = useFilters((s) => s.set);
  const live = useLocation((s) => s.live);
  const registered = useLocation((s) => s.registered);
  const permission = useLocation((s) => s.permission);
  const activeOrigin = useLocation((s) => s.activeOrigin);
  const liveOutsidePilot = useLocation((s) => s.liveOutsidePilot);
  const setPreferred = useLocation((s) => s.setPreferred);
  const address = useProfile((s) => s.address);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const reset = () => {
    setMessage(null);
    setBlocked(false);
  };

  const pickArea = (a: string | null) => {
    set({ area: a });
    reset();
    onClose();
  };

  const nearMe = async () => {
    setBusy(true);
    reset();
    setPreferred('live');
    const res = await refreshDeviceLocation(true);
    setBusy(false);
    if (res.ok) {
      if (useLocation.getState().liveOutsidePilot) {
        set({ area: null });
        setMessage(`${OUTSIDE_PILOT_MESSAGE}. Escolha outra origem ou um bairro se quiser.`);
        return;
      }
      pickArea(null);
      return;
    }
    setBlocked(res.reason === 'blocked');
    setMessage(FAIL_MESSAGES[res.reason]);
  };

  const nearHome = () => {
    setPreferred('registered');
    pickArea(null);
  };

  const register = () => {
    reset();
    onClose();
    router.push('/dados-cadastrais');
  };

  const liveSubtitle = busy
    ? 'Buscando sua localização...'
    : live && permission === 'granted'
      ? liveOutsidePilot
        ? OUTSIDE_PILOT_MESSAGE
        : `Tempo real · ${live.point.label} · ${relativeTimePt(live.at)}`
      : permission === 'blocked'
        ? 'Bloqueada nas configurações'
        : 'Permitir localização';
  const homeSubtitle = address ? addressLabel(address) : registered ? `Bairro: ${registered.label}` : 'Nenhum endereço cadastrado';

  const origins: Origin[] = ['live', 'registered'];
  const selected = origins.indexOf(activeOrigin as Origin);
  const rg = radioGroup(selected, origins.length, (i) => (origins[i] === 'live' ? void nearMe() : registered && nearHome()));

  return (
    <Sheet visible={visible} onClose={onClose} title="Onde você quer sair?" testID="area-sheet">
      <View style={styles.body}>
        <Text variant="caption" tone="textMuted" accessibilityRole="header">
          CONTAR A DISTÂNCIA A PARTIR DE
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Contar a distância a partir de" style={styles.options} {...rg.group}>
          <OriginOption
            title="Perto de mim agora"
            subtitle={liveSubtitle}
            icon="compass"
            checked={activeOrigin === 'live'}
            disabled={busy}
            onPress={nearMe}
            testID="origin-option-live"
            a11y={rg.item(0)}
          />
          <OriginOption
            title="Perto de casa"
            subtitle={homeSubtitle}
            icon="pin"
            checked={activeOrigin === 'registered'}
            disabled={!registered}
            onPress={nearHome}
            testID="origin-option-registered"
            a11y={rg.item(1)}
          />
        </View>
        {!registered ? <Button label="Cadastrar endereço" variant="ghost" icon="plus" onPress={register} testID="area-cadastrar" /> : null}
        {message ? (
          <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" testID="area-message">
            {message}
          </Text>
        ) : null}
        {blocked || (permission === 'blocked' && !message) ? (
          <ListRow title="Abrir configurações" subtitle="Libere a localização para o app" icon="compass" onPress={() => openSettings()} divider />
        ) : null}

        <Text variant="caption" tone="textMuted" accessibilityRole="header" style={styles.section}>
          OU FILTRAR POR BAIRRO
        </Text>
        <View style={styles.chips}>
          <Chip label="Todos os bairros" selected={area === null} onPress={() => pickArea(null)} />
          {(areas ?? []).map((a) => (
            <Chip key={a} label={a} selected={area === a} onPress={() => pickArea(a)} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  options: { gap: space.sm },
  option: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  disabled: { opacity: 0.5 },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  section: { marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, minHeight: hit.chip },
});
