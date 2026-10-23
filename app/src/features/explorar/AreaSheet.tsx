import { View } from 'react-native';

import { useAreas } from '@/data/queries';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { ListRow, Sheet } from '@/ui';

/** Simple "onde você está?" picker: reset to the default point, or narrow to one region. */
export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: areas } = useAreas();
  const area = useFilters((s) => s.filters.area);
  const set = useFilters((s) => s.set);
  const isCustom = useLocation((s) => s.isCustom);
  const resetLocation = useLocation((s) => s.resetLocation);
  const pick = (a: string | null) => {
    set({ area: a });
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Onde você quer sair?" testID="area-sheet">
      <View>
        <ListRow
          title="Perto de mim"
          subtitle={isCustom ? 'Voltar ao ponto padrão' : 'Praia do Canto, Vitória'}
          icon="pin"
          value={area === null ? 'Ativo' : undefined}
          onPress={() => {
            resetLocation();
            pick(null);
          }}
          divider
        />
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
