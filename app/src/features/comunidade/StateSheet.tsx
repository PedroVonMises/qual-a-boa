import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { isPilotUf, REGIONS, ufName } from '@/domain/region';
import { useRegion } from '@/state/region';
import { breakpoints, space } from '@/theme/tokens';
import { ListRow, Sheet, Text } from '@/ui';

const noop = () => undefined;

/**
 * "Seu estado": the Comunidade shows conversations from one state. All 27 are listed; during the pilot only the open
 * ones can be chosen and the rest are dimmed with "Em breve".
 */
export function StateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const uf = useRegion((s) => s.uf);
  const setUf = useRegion((s) => s.setUf);
  const { height, width } = useWindowDimensions();
  // The right-hand drawer (web, wide) has the full height; a bottom sheet tops out at 85% minus its header and intro.
  const listMaxHeight = Platform.OS === 'web' && width >= breakpoints.lg ? height - 200 : height * 0.85 - 230;

  const pick = (next: string) => {
    setUf(next);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Seu estado" testID="state-sheet">
      <Text variant="bodySm" tone="textMuted" style={styles.intro}>
        A Comunidade mostra as conversas do estado escolhido. Por enquanto, só {ufName('ES')} está aberto.
      </Text>
      {/* The native sheet does not scroll its own content, so the long list scrolls inside a capped height. */}
      <ScrollView style={{ maxHeight: Math.max(listMaxHeight, 240) }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <View>
          {REGIONS.map((r) =>
            isPilotUf(r.uf) ? (
              <ListRow
                key={r.uf}
                title={r.name}
                icon="pin"
                value={r.uf === uf ? 'Ativo' : undefined}
                onPress={() => pick(r.uf)}
                divider
                testID={`state-${r.uf}`}
              />
            ) : (
              <ListRow key={r.uf} title={r.name} icon="pin" subtitle="Em breve" disabled onPress={noop} divider testID={`state-${r.uf}`} />
            ),
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { paddingBottom: space.md },
});
