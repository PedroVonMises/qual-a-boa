import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useArtistSearch } from '@/data/queries';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { ArtistRow, Button, SearchBar, Text } from '@/ui';

function useDebounced(value: string, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ArtistPicker() {
  const artistId = useFilters((s) => s.filters.artistId);
  const set = useFilters((s) => s.set);
  const [text, setText] = useState('');
  const [pickedName, setPickedName] = useState<string | null>(null);
  const { data } = useArtistSearch(useDebounced(text));
  const results = text.trim() ? (data ?? []) : [];

  return (
    <View style={styles.wrap}>
      {artistId ? (
        <View style={styles.selected}>
          <Text variant="body" style={styles.flex}>
            Artista: {pickedName ?? 'selecionado'}
          </Text>
          <Button
            label="Remover"
            variant="ghost"
            accessibilityLabel="Remover filtro de artista"
            onPress={() => {
              set({ artistId: null });
              setPickedName(null);
            }}
          />
        </View>
      ) : null}
      <SearchBar value={text} onChangeText={setText} placeholder="Buscar artista" label="Buscar artista" testID="artist-search" />
      {results.map((a) => (
        <ArtistRow
          key={a.id}
          name={a.name}
          subtitle={a.id === artistId ? 'Selecionado' : undefined}
          imageUri={a.photoUrl}
          testID={`artist-${a.id}`}
          onPress={() => {
            set({ artistId: a.id });
            setPickedName(a.name);
            setText('');
          }}
          divider
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  selected: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
