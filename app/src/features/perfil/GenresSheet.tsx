import { StyleSheet, View } from 'react-native';

import { useGenres } from '@/data/queries';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { Chip, Sheet, Text } from '@/ui';

export function GenresSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const genres = useGenres();
  const picked = useFilters((s) => s.filters.genreSlugs);
  const toggleGenre = useFilters((s) => s.toggleGenre);
  return (
    <Sheet visible={visible} onClose={onClose} title="Estilos favoritos" testID="genres-sheet">
      <View style={styles.chips}>
        {genres.isLoading ? <Text tone="textMuted">Carregando estilos...</Text> : null}
        {(genres.data ?? []).map((g) => (
          <Chip key={g.slug} label={g.label} selected={picked.includes(g.slug)} onPress={() => toggleGenre(g.slug)} />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } });