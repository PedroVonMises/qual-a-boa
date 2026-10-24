import { useState } from 'react';
import { View } from 'react-native';

import { useAreas } from '@/data/queries';
import { OUTSIDE_PILOT_MESSAGE, openSettings, refreshDeviceLocation } from '@/lib/location';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { ListRow, Sheet, Text } from '@/ui';

const FAIL_MESSAGES = {
  denied: 'Sem permissão de localização. Escolha um bairro abaixo.',
  blocked: 'A localização está bloqueada para o app. Abra as configurações ou escolha um bairro abaixo.',
  unavailable: 'Não deu para pegar sua localização agora. Escolha um bairro abaixo.',
  timeout: 'Não deu para pegar sua localização agora. Escolha um bairro abaixo.',
} as const;

/** "Onde você quer sair?" picker: device location (requested/refreshed on tap) or one region. */
export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: areas } = useAreas();
  const area = useFilters((s) => s.filters.area);
  const set = useFilters((s) => s.set);
  const source = useLocation((s) => s.source);
  const label = useLocation((s) => s.location.label);
  const outsidePilot = useLocation((s) => s.outsidePilot);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const pick = (a: string | null) => {
    set({ area: a });
    setMessage(null);
    setBlocked(false);
    onClose();
  };

  const nearMe = async () => {
    setBusy(true);
    setMessage(null);
    setBlocked(false);
    const res = await refreshDeviceLocation(true);
    setBusy(false);
    if (res.ok) {
      if (useLocation.getState().outsidePilot) {
        set({ area: null });
        setMessage(`${OUTSIDE_PILOT_MESSAGE}. Mostrando o ponto padrão, escolha um bairro se quiser.`);
        return;
      }
      pick(null);
      return;
    }
    setBlocked(res.reason === 'blocked');
    setMessage(FAIL_MESSAGES[res.reason]);
  };

  const subtitle = busy
    ? 'Buscando sua localização...'
    : source === 'device'
      ? outsidePilot
        ? OUTSIDE_PILOT_MESSAGE
        : `${label}. Toque para atualizar`
      : 'Usar minha localização';

  return (
    <Sheet visible={visible} onClose={onClose} title="Onde você quer sair?" testID="area-sheet">
      <View>
        <ListRow
          title="Perto de mim"
          subtitle={subtitle}
          icon="pin"
          value={area === null && source === 'device' ? 'Ativo' : undefined}
          onPress={nearMe}
          disabled={busy}
          divider
        />
        {message ? (
          <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" testID="area-message">
            {message}
          </Text>
        ) : null}
        {blocked ? <ListRow title="Abrir configurações" icon="pin" onPress={() => openSettings()} divider /> : null}
        {(areas ?? []).map((a) => (
          <ListRow
            key={a}
            title={a}
            icon="map"
            value={area === a ? 'Ativo' : undefined}
            onPress={() => pick(a)}
            divider
          />
        ))}
      </View>
    </Sheet>
  );
}
