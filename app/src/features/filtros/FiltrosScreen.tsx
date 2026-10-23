import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import { useSearchParams } from '@/features/explorar/useSearch';
import { useFilters } from '@/state/filters';
import { maxContentWidth, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Screen, ScreenHeader, Sheet, useBreakpoint } from '@/ui';
import { Sections } from './Sections';
import { useUrlSync } from './useUrlSync';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function viewLabel(total: number | undefined): string {
  if (total === undefined) return 'Ver eventos';
  return total === 1 ? 'Ver 1 evento' : `Ver ${total} eventos`;
}

function useLiveTotal(): number | undefined {
  const filters = useFilters((s) => s.filters);
  return useSearchEvents(useSearchParams(filters, 1)).data?.pages[0]?.total;
}

function Footer({ total }: { total: number | undefined }) {
  const reset = useFilters((s) => s.reset);
  return (
    <>
      <Button label="Limpar" variant="secondary" onPress={reset} testID="filtros-clear" />
      <Button label={viewLabel(total)} onPress={close} style={styles.grow} testID="filtros-apply" />
    </>
  );
}

export function FiltrosScreen() {
  useUrlSync();
  const total = useLiveTotal();
  const { isLarge } = useBreakpoint();
  const { colors } = useTheme();

  if (isLarge) {
    // Web / large tablets: right-hand drawer instead of a full screen.
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Sheet visible onClose={close} title="Filtros" footer={<Footer total={total} />} testID="filtros-drawer">
          <Sections />
        </Sheet>
      </View>
    );
  }
  return (
    <Screen bleed edges={['top', 'bottom']} testID="filtros-screen">
      <View style={styles.inner}>
        <ScreenHeader title="Filtros" onBack={close} style={styles.pad} />
        <ScrollView contentContainerStyle={[styles.pad, styles.scroll]} keyboardShouldPersistTaps="handled">
          <Sections />
        </ScrollView>
        <View style={[styles.footer, styles.pad, { borderTopColor: colors.border }]}>
          <Footer total={total} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  pad: { paddingHorizontal: space.lg },
  scroll: { paddingVertical: space.lg },
  footer: { flexDirection: 'row', gap: space.md, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: 1 },
  grow: { flex: 1 },
});
