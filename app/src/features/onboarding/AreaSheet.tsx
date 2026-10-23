import { View } from 'react-native';

import { useAreas } from '@/data/queries';
import { Sheet, ListRow, Text } from '@/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (area: string) => void;
}

/** Neighborhood picker for manual location. */
export function AreaSheet({ visible, onClose, onSelect }: Props) {
  const { data, isLoading, isError } = useAreas();
  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher o bairro" testID="area-sheet">
      <View>
        {isLoading ? <Text tone="textMuted">Carregando bairros...</Text> : null}
        {isError ? <Text tone="dangerText">Não deu para carregar os bairros. Tente de novo.</Text> : null}
        {(data ?? []).map((area, i, all) => (
          <ListRow key={area} title={area} icon="pin" chevron divider={i < all.length - 1} onPress={() => onSelect(area)} />
        ))}
      </View>
    </Sheet>
  );
}