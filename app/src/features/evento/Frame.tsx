import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { EmptyState, ErrorState, IconButton, Skeleton, useBreakpoint } from '@/ui';
import { useInsets } from '@/ui/useInsets';

export const DETAIL_MAX_WIDTH = 960;

export function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

/** Scrolling detail layout with an optional sticky footer, centered (max 960) on wide screens. */
export function Frame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.col}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + space.md }]}>
          <View style={[styles.col, styles.footerRow, { paddingHorizontal: gutter }]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export type StateKind = 'loading' | 'error' | 'missing';

/** Loading / error / not-found shell with a back button. */
export function StateShell({
  state,
  onRetry,
  notFound,
}: {
  state: StateKind;
  onRetry?: () => void;
  notFound?: { title: string; message: string };
}) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const insets = useInsets();
  const back = useGoBack();
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.col, { paddingHorizontal: gutter, gap: space.lg }]}>
        <View style={styles.backRow}>
          <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={back} />
        </View>
        {state === 'loading' ? (
          <View testID="detail-skeleton" accessibilityRole="progressbar" accessibilityLabel="Carregando" style={styles.skeleton}>
            <Skeleton height={240} radius={24} />
            <Skeleton width="60%" height={28} />
            <Skeleton width="40%" height={18} />
            <Skeleton width="50%" height={18} />
          </View>
        ) : state === 'error' ? (
          <ErrorState onRetry={onRetry} />
        ) : (
          <EmptyState title={notFound?.title ?? 'Não encontramos isso'} message={notFound?.message} actionLabel="Voltar para o início" onAction={back} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: space.xxxl },
  col: { width: '100%', maxWidth: DETAIL_MAX_WIDTH, alignSelf: 'center' },
  footer: { borderTopWidth: 1, paddingTop: space.md },
  footerRow: { flexDirection: 'row', gap: space.md },
  backRow: { flexDirection: 'row' },
  skeleton: { gap: space.md },
});
