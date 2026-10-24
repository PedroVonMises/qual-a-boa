import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import type { VenueMapProps } from './mapTypes';
import { pinLabel } from './pins';
import { NEIGHBORHOODS, project } from './projection';

const PIN_W = 160;

/** Schematic SVG map: fallback when the real map cannot load (offline, style error, no native module). */
export function VenueMapSchematic({ pins, selectedId, onSelect, userLocation }: VenueMapProps) {
  const { colors } = useTheme();
  const at = (lat: number, lng: number) => {
    const p = project(lat, lng);
    return { left: `${p.x * 100}%` as const, top: `${p.y * 100}%` as const };
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel="Mapa esquemático de casas abertas">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Rect width="100" height="100" fill={colors.surfaceAlt} />
        <Path d="M8 30 Q20 8 50 12 T85 28 Q95 50 80 66 Q60 82 38 76 Q12 70 8 30z" fill={colors.surface} />
        <Path d="M10 40 L85 36 M30 18 L42 76 M12 60 L80 54 M62 16 L70 72" stroke={colors.border} strokeWidth={1.2} fill="none" />
      </Svg>
      {NEIGHBORHOODS.map((n) => (
        <View key={n.name} pointerEvents="none" style={[styles.hood, at(n.lat, n.lng)]}>
          <Text variant="caption" tone="textMuted" style={styles.hoodText}>
            {n.name.toUpperCase()}
          </Text>
        </View>
      ))}
      {userLocation ? (
        <View
          accessibilityLabel="Você está aqui"
          style={[styles.user, at(userLocation.lat, userLocation.lng), { backgroundColor: colors.accent, borderColor: colors.text }]}
        />
      ) : null}
      {pins.map((pin) => {
        const selected = pin.venue.id === selectedId;
        return (
          <View key={pin.venue.id} style={[styles.pinWrap, at(pin.venue.lat, pin.venue.lng)]} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pinLabel(pin)}
              accessibilityState={{ selected }}
              onPress={() => onSelect(pin.venue.id)}
              style={[styles.pill, { backgroundColor: selected ? colors.accent : colors.text }]}>
              <Text variant="bodySm" tone={selected ? colors.onAccent : colors.background} style={styles.name} numberOfLines={1}>
                {pin.venue.name}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', minHeight: 240 },
  hood: { position: 'absolute' },
  hoodText: { fontWeight: '600', letterSpacing: 1 },
  user: { position: 'absolute', width: 18, height: 18, borderRadius: radius.full, borderWidth: 3 },
  pinWrap: { position: 'absolute', width: PIN_W, marginLeft: -PIN_W / 2, alignItems: 'center' },
  pill: {
    minHeight: hit.min,
    maxWidth: PIN_W,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  name: { fontWeight: '600' },
});
