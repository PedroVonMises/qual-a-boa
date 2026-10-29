import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { recheckOnline, useOnline } from '@/lib/network';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PressableScale, TAB_BAR_HEIGHT, Text, useBreakpoint } from '@/ui';
import { useInsets } from '@/ui/useInsets';

/**
 * Floating notice while offline. Cached results stay on screen (queries pause instead of failing), so the copy says
 * what the user is looking at and offers a manual retry. It never covers the tab bar.
 */
export function OfflineBanner() {
  const online = useOnline();
  const client = useQueryClient();
  const { colors } = useTheme();
  const { isLarge } = useBreakpoint();
  const insets = useInsets();
  const [stillOffline, setStillOffline] = useState(false);
  if (online) return null;

  const retry = () => {
    const ok = recheckOnline();
    setStillOffline(!ok);
    if (ok) void client.refetchQueries({ type: 'active' });
  };

  const bottom = (isLarge ? 0 : TAB_BAR_HEIGHT) + insets.bottom + space.md;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        testID="offline-banner">
        <View style={styles.text}>
          <Text variant="bodySm" style={styles.bold}>
            Sem internet
          </Text>
          <Text variant="bodySm" tone="textMuted">
            {stillOffline ? 'Ainda sem conexão. ' : ''}Mostrando o que já estava carregado. Preços e horários podem ter mudado.
          </Text>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Tentar conectar de novo" onPress={retry} style={styles.retry} testID="offline-retry">
          <Text variant="bodySm" tone="accent" style={styles.bold}>
            Tentar
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  banner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.md },
});
